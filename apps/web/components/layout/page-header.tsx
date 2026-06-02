export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description?: string
}) {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-16 text-center sm:px-6">
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          {eyebrow}
        </p>
        <h1 className="font-heading text-3xl font-medium tracking-tight text-balance text-foreground sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mx-auto max-w-xl text-sm/relaxed text-pretty text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    </header>
  )
}
