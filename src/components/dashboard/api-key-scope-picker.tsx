'use client'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { type ApiKeyScope, SCOPE_DESCRIPTIONS, SCOPE_GROUPS, SCOPE_LABELS } from '@/lib/api-key-scopes'

// One permission list for every key: grouped sections, each scope with its code
// and what it grants. The footer shows the effective grant set.
export function ApiKeyScopePicker({
  idPrefix,
  scopes,
  onChange,
}: {
  idPrefix: string
  scopes: ApiKeyScope[]
  onChange: (next: ApiKeyScope[]) => void
}) {
  const granted = SCOPE_GROUPS.flatMap((group) => group.scopes).filter((scope) => scopes.includes(scope))
  const selectedIn = (groupScopes: readonly ApiKeyScope[]) =>
    groupScopes.filter((scope) => scopes.includes(scope)).length

  return (
    <div className="flex flex-col gap-3">
      <Accordion multiple keepMounted defaultValue={SCOPE_GROUPS.map((group) => group.resource)}>
        {SCOPE_GROUPS.map((group) => (
          <AccordionItem key={group.resource} value={group.resource}>
            <AccordionTrigger>
              <span className="flex items-center gap-2">
                {group.label}
                <span className="font-normal text-muted-foreground tabular-nums">
                  {selectedIn(group.scopes)}/{group.scopes.length}
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <FieldGroup data-slot="checkbox-group">
                {group.scopes.map((scope) => {
                  const id = `${idPrefix}-${scope}`
                  return (
                    <Field key={scope} orientation="horizontal">
                      <Checkbox
                        id={id}
                        checked={scopes.includes(scope)}
                        onCheckedChange={() =>
                          onChange(
                            scopes.includes(scope) ? scopes.filter((item) => item !== scope) : [...scopes, scope],
                          )
                        }
                      />
                      <FieldContent>
                        <FieldLabel htmlFor={id} className="flex-wrap gap-x-2 gap-y-0.5">
                          <span>{SCOPE_LABELS[scope]}</span>
                          <code className="text-xs font-normal text-muted-foreground">{scope}</code>
                        </FieldLabel>
                        <FieldDescription>{SCOPE_DESCRIPTIONS[scope]}</FieldDescription>
                      </FieldContent>
                    </Field>
                  )
                })}
              </FieldGroup>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <div className="flex flex-wrap items-center gap-1.5">
        {granted.length === 0 ? (
          <span className="text-sm text-muted-foreground">No permissions selected</span>
        ) : (
          <>
            <span className="text-sm text-muted-foreground">Grants</span>
            {granted.map((scope) => (
              <Badge key={scope} variant="secondary" className="font-mono">
                {scope}
              </Badge>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
