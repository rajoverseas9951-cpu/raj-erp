export interface QueryOptions {
  tenantId?: string;
  limit?: number;
  offset?: number;
}

export interface BaseRepository<TEntity, TId = string> {
  findById(id: TId, options?: QueryOptions): Promise<TEntity | null>;
  findMany(options?: QueryOptions): Promise<TEntity[]>;
  create(entity: Partial<TEntity>, options?: QueryOptions): Promise<TEntity>;
  update(id: TId, entity: Partial<TEntity>, options?: QueryOptions): Promise<TEntity>;
  delete(id: TId, options?: QueryOptions): Promise<void>;
}
