export type DbClient = import('@prisma/client').PrismaClient

export async function createDbClient(databaseUrl: string): Promise<DbClient> {
  const [{ PrismaClient }, { PrismaLibSql }] = await Promise.all([
    import('@prisma/client'),
    import('@prisma/adapter-libsql'),
  ])

  const adapter = new PrismaLibSql({ url: databaseUrl })
  const client = new PrismaClient({ adapter })
  await client.$connect()
  return client
}
