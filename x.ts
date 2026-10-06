import { Injector, inject, type ResourceParamsContext } from '@angular/core';
import {
    HttpClient,
    HttpContext,
    HttpContextToken,
    HttpErrorResponse,
    HttpResponse,
    httpResource,
    type HttpHandler,
    type HttpRequest,
    type HttpResourceOptions,
    type HttpResourceRef,
    type HttpResourceRequest,
} from '@angular/common/http';
import { delay, of, switchMap, throwError, timer, type Observable } from 'rxjs';

const MOCK_DELAY_MS = 1000;

const MOCK_PAYLOAD = new HttpContextToken<{ value: unknown } | undefined>(() => undefined);

type MockRequest = (ctx: ResourceParamsContext) => string | HttpResourceRequest | undefined;

export function mockHttpResource<X>(
    request: MockRequest,
    options: (HttpResourceOptions<X, unknown> & { defaultValue: NoInfer<X> }) | undefined,
    mockData: () => X | undefined,
    needError?: boolean,
): HttpResourceRef<X>;
export function mockHttpResource<X>(
    request: MockRequest,
    options: HttpResourceOptions<X, unknown> | undefined,
    mockData: () => X | undefined,
    needError?: boolean,
): HttpResourceRef<X | undefined>;
export function mockHttpResource<X>(
    request: MockRequest,
    options: HttpResourceOptions<X, unknown> | undefined,
    mockData: () => X | undefined,
    needError = false,
): HttpResourceRef<X | undefined> {
    const parent = options?.injector ?? inject(Injector);

    const handler: HttpHandler = {
        handle(req: HttpRequest<any>): Observable<any> {
            if (needError) {
                return timer(MOCK_DELAY_MS).pipe(
                    switchMap(() =>
                        throwError(
                            () =>
                                new HttpErrorResponse({
                                    status: 500,
                                    statusText: 'Mock Error',
                                    url: req.urlWithParams,
                                    error: 'Mock error',
                                }),
                        ),
                    ),
                );
            }
            const payload = req.context.get(MOCK_PAYLOAD);
            return of(new HttpResponse({ body: payload?.value, status: 200, url: req.urlWithParams })).pipe(
                delay(MOCK_DELAY_MS),
            );
        },
    };

    const injector = Injector.create({
        parent,
        providers: [{ provide: HttpClient, useFactory: () => new HttpClient(handler) }],
    });

    const mockedRequest = (ctx: ResourceParamsContext): HttpResourceRequest | undefined => {
        const data = mockData();
        if (data === undefined) {
            return undefined;
        }
        const raw = request(ctx);
        if (raw === undefined) {
            return undefined;
        }
        const req: HttpResourceRequest = typeof raw === 'string' ? { url: raw } : raw;

        const context = new HttpContext();
        if (req.context) {
            for (const key of req.context.keys()) {
                context.set(key, req.context.get(key));
            }
        }
        context.set(MOCK_PAYLOAD, { value: data });

        return { ...req, context };
    };

    const rest: HttpResourceOptions<X, unknown> = { ...options };
    delete rest.parse;

    return httpResource<X>(mockedRequest, { ...rest, injector }) as HttpResourceRef<X | undefined>;
}
