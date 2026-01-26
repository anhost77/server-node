import { z } from 'zod';
export declare const ExampleSchema: z.ZodObject<{
    foo: z.ZodString;
}, "strip", z.ZodTypeAny, {
    foo: string;
}, {
    foo: string;
}>;
export type Example = z.infer<typeof ExampleSchema>;
//# sourceMappingURL=index.d.ts.map