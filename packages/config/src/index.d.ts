import { z } from 'zod';
export declare const ConfigSchema: z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodEnum<["development", "production", "test"]>>;
}, "strip", z.ZodTypeAny, {
    NODE_ENV: "development" | "production" | "test";
}, {
    NODE_ENV?: "development" | "production" | "test" | undefined;
}>;
export declare const config: {
    NODE_ENV: "development" | "production" | "test";
};
//# sourceMappingURL=index.d.ts.map