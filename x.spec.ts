/// <reference types="node" />
import '@angular/compiler';
import { describe, it, expect, beforeAll } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { mockHttpResource } from './x';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
interface User {
    id: number;
    name: string;
}

describe('mockHttpResource', () => {
    beforeAll(() => {
        TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
    });

    it('success: loading -> resolved after ~1s, like httpResource', async () => {
        const res = TestBed.runInInjectionContext(() =>
            mockHttpResource<User>(
                () => '/u',
                undefined,
                () => ({ id: 1, name: 'A' }),
            ),
        );
        TestBed.tick();
        expect(res.status()).toBe('loading');
        expect(res.isLoading()).toBe(true);
        expect(res.hasValue()).toBe(false);
        expect(res.value()).toBeUndefined();
        await sleep(500);
        TestBed.tick();
        expect(res.isLoading()).toBe(true);
        await sleep(700);
        TestBed.tick();
        expect(res.status()).toBe('resolved');
        expect(res.isLoading()).toBe(false);
        expect(res.hasValue()).toBe(true);
        expect(res.value()).toEqual({ id: 1, name: 'A' });
        expect(res.error()).toBeUndefined();
        expect(res.statusCode()).toBe(200);
    });

    it('needError: error state', async () => {
        const res = TestBed.runInInjectionContext(() =>
            mockHttpResource<User>(
                () => ({ url: '/u' }),
                undefined,
                () => ({ id: 1, name: 'A' }),
                true,
            ),
        );
        TestBed.tick();
        expect(res.isLoading()).toBe(true);
        await sleep(1200);
        TestBed.tick();
        expect(res.status()).toBe('error');
        expect(res.isLoading()).toBe(false);
        expect(res.hasValue()).toBe(false);
        expect(res.error()).toBeTruthy();
        expect((res.error() as any).status).toBe(500);
        expect(res.statusCode()).toBe(500);
        expect(() => res.value()).toThrow(/.+/);
    });

    it('mockData undefined -> idle, no request; becomes loading when data appears', async () => {
        const id = signal<number | undefined>(undefined);
        const res = TestBed.runInInjectionContext(() =>
            mockHttpResource<User>(
                () => '/u',
                undefined,
                () => (id() ? { id: id()!, name: 'B' } : undefined),
            ),
        );
        TestBed.tick();
        expect(res.status()).toBe('idle');
        expect(res.isLoading()).toBe(false);
        expect(res.hasValue()).toBe(false);
        await sleep(1200);
        TestBed.tick();
        expect(res.status()).toBe('idle');

        id.set(7);
        TestBed.tick();
        expect(res.status()).toBe('loading');
        await sleep(1200);
        TestBed.tick();
        expect(res.value()).toEqual({ id: 7, name: 'B' });

        id.set(undefined);
        TestBed.tick();
        expect(res.status()).toBe('idle');
    });

    it('request returning undefined -> idle', async () => {
        const res = TestBed.runInInjectionContext(() =>
            mockHttpResource<User>(
                () => undefined,
                undefined,
                () => ({ id: 1, name: 'A' }),
            ),
        );
        TestBed.tick();
        expect(res.status()).toBe('idle');
    });

    it('defaultValue and reload and param change (stale response dropped)', async () => {
        const id = signal(1);
        const res = TestBed.runInInjectionContext(() =>
            mockHttpResource<User>(
                () => `/u/${id()}`,
                { defaultValue: { id: 0, name: 'def' } },
                () => ({ id: id(), name: 'N' }),
            ),
        );
        TestBed.tick();
        expect(res.value()).toEqual({ id: 0, name: 'def' });
        await sleep(500);
        id.set(2);
        TestBed.tick();
        await sleep(700); // first request's 1s has passed but it was aborted
        TestBed.tick();
        expect(res.isLoading()).toBe(true);
        await sleep(500);
        TestBed.tick();
        expect(res.value()).toEqual({ id: 2, name: 'N' });
        res.reload();
        TestBed.tick();
        expect(res.status()).toBe('reloading');
    });

    it('user HttpContext not mutated', async () => {
        const { HttpContext, HttpContextToken } = await import('@angular/common/http');
        const tok = new HttpContextToken(() => 'x');
        const ctx = new HttpContext().set(tok, 'y');
        const res = TestBed.runInInjectionContext(() =>
            mockHttpResource<number>(
                () => ({ url: '/c', context: ctx }),
                undefined,
                () => 5,
            ),
        );
        TestBed.tick();
        await sleep(1200);
        TestBed.tick();
        expect(res.value()).toBe(5);
        expect([...ctx.keys()].length).toBe(1);
    });
});
