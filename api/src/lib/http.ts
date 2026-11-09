import type { FastifyReply } from 'fastify';
import { ZodError, type ZodType, type ZodTypeDef } from 'zod';
import { idParamSchema } from '@gabi/shared';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function parse<T>(schema: ZodType<T, ZodTypeDef, unknown>, data: unknown): T {
  return schema.parse(data);
}

export function idOf(params: unknown): number {
  return idParamSchema.parse(params).id;
}

export function notFound(): never {
  throw new HttpError(404, 'Não encontrado');
}

export function errorHandler(err: Error & { statusCode?: number }, reply: FastifyReply) {
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return reply.code(400).send({ error: first?.message ?? 'Dados inválidos', issues: err.issues });
  }
  if (err instanceof HttpError) return reply.code(err.status).send({ error: err.message });
  // Violação de FK (ex.: categoria inexistente)
  if ((err as { code?: string }).code === '23503') return reply.code(400).send({ error: 'Referência inválida' });
  if ((err as { code?: string }).code === '23505') return reply.code(409).send({ error: 'Já existe um item com esse nome' });
  if (err.statusCode && err.statusCode < 500) return reply.code(err.statusCode).send({ error: err.message });
  reply.log.error(err);
  return reply.code(500).send({ error: 'Erro interno' });
}

/** Monta "SET a = $1, b = $2" a partir de um patch parcial. `cols` mapeia campo → coluna. */
export function buildUpdate(
  patch: Record<string, unknown>,
  cols: Record<string, string>,
  startIndex = 2,
): { set: string; values: unknown[] } {
  const parts: string[] = [];
  const values: unknown[] = [];
  for (const [key, col] of Object.entries(cols)) {
    if (patch[key] !== undefined) {
      values.push(patch[key]);
      parts.push(`${col} = $${startIndex + values.length - 1}`);
    }
  }
  return { set: parts.join(', '), values };
}
