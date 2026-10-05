import { BadRequestException, type PipeTransform } from '@nestjs/common';

/** Sous-ensemble de l'API Zod utilisé ici (compatible Zod 3 et 4). */
interface SafeParser<T> {
  safeParse(
    input: unknown,
  ):
    | { success: true; data: T }
    | { success: false; error: { issues: ReadonlyArray<{ path: PropertyKey[]; message: string }> } };
}

/** Valide `@Body()` ou `@Query()` avec un schéma du paquet partagé. */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: SafeParser<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    throw new BadRequestException({
      message: 'Requête invalide',
      errors: result.error.issues.map((issue) => {
        const path = issue.path.map(String).join('.');
        return path ? `${path} : ${issue.message}` : issue.message;
      }),
    });
  }
}
