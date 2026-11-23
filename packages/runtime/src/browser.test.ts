import { describe, expect, it } from 'vitest';
import { serverless_args } from './browser.ts';

describe('serverless_args', () => {
  it('vynechá SwiftShader, jeden proces a vypnutú same-origin policy', () => {
    const args = serverless_args([
      '--no-sandbox',
      '--single-process',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--disable-web-security',
      "--headless='shell'",
    ]);
    expect(args).toEqual(['--no-sandbox', "--headless='shell'", '--disable-gpu']);
  });
});
