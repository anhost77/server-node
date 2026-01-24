import { z } from 'zod';

export const ExampleSchema = z.object({
    foo: z.string()
});

export type Example = z.infer<typeof ExampleSchema>;
