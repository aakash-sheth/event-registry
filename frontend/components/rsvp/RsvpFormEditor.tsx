 'use client'
 
 import React from 'react'
 import { Input } from '@/components/ui/input'
 import type { RsvpCustomFieldConfig, RsvpFieldOption, RsvpFormConfig } from '@/lib/invite/schema'
 
 interface RsvpFormEditorProps {
   value?: RsvpFormConfig
   onChange: (next: RsvpFormConfig) => void
   customFieldsMetadata: Record<string, any>
 }
 
 function getDisplayLabel(metadata: Record<string, any>, key: string) {
   const val = metadata[key]
   if (typeof val === 'string') return val
   if (val && typeof val === 'object') return val.display_label || val.label || key
   return key
 }
 
 export default function RsvpFormEditor({ value, onChange, customFieldsMetadata }: RsvpFormEditorProps) {
   const form: RsvpFormConfig = value || { version: 1, customFields: [], systemFields: {} }
   const customFields = (form.customFields || []) as RsvpCustomFieldConfig[]
 
   const setForm = (next: RsvpFormConfig) => onChange({ ...next, version: 1 })
 
   const upsertField = (nextField: RsvpCustomFieldConfig) => {
     const next = [...customFields]
     const idx = next.findIndex((f) => f.key === nextField.key)
     if (idx >= 0) next[idx] = nextField
     else next.push(nextField)
     setForm({ ...form, customFields: next })
   }
 
   const keys = Object.keys(customFieldsMetadata || {}).sort()
 
   return (
     <div className="space-y-4">
      {/* Mandatory fields (always shown on RSVP) */}
      <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
        <h4 className="text-sm font-semibold text-gray-800 mb-2">Always shown (mandatory)</h4>
        <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
          <li>Full Name</li>
          <li>Phone Number</li>
          <li>Will you attend? (Yes / Maybe / No)</li>
        </ul>
        <p className="text-xs text-gray-500 mt-2">
          These fields are required for RSVP and can’t be hidden.
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Sub-event selection may appear automatically depending on your event setup and guest permissions.
        </p>
      </div>

       {/* System fields */}
       <div className="border rounded-md p-3">
         <h4 className="text-sm font-semibold text-gray-800 mb-2">System fields</h4>
 
        {/* Email */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Email</label>
           <input
             type="checkbox"
            checked={(form.systemFields?.email?.enabled ?? true) === true}
             onChange={(e) =>
               setForm({
                 ...form,
                 systemFields: {
                   ...(form.systemFields || {}),
                  email: { enabled: e.target.checked },
                 },
               })
             }
             className="w-4 h-4 text-eco-green focus:ring-eco-green border-gray-300 rounded"
           />
         </div>
 
         {/* Guest count */}
         <div className="mt-3 flex items-center justify-between">
           <label className="text-sm font-medium">Guest count</label>
           <input
             type="checkbox"
             checked={(form.systemFields?.guests_count?.enabled ?? true) === true}
             onChange={(e) =>
               setForm({
                 ...form,
                 systemFields: {
                   ...(form.systemFields || {}),
                   guests_count: { enabled: e.target.checked },
                 },
               })
             }
             className="w-4 h-4 text-eco-green focus:ring-eco-green border-gray-300 rounded"
           />
         </div>
 
        {/* Notes */}
        <div className="mt-3 flex items-center justify-between">
          <label className="text-sm font-medium">Notes</label>
          <input
            type="checkbox"
            checked={(form.systemFields?.notes?.enabled ?? true) === true}
            onChange={(e) =>
              setForm({
                ...form,
                systemFields: {
                  ...(form.systemFields || {}),
                  notes: {
                    enabled: e.target.checked,
                    label: form.systemFields?.notes?.label,
                    helpText: form.systemFields?.notes?.helpText,
                  },
                },
              })
            }
            className="w-4 h-4 text-eco-green focus:ring-eco-green border-gray-300 rounded"
          />
        </div>

        {(form.systemFields?.notes?.enabled ?? true) && (
          <div className="mt-3 space-y-2">
            <div>
              <label className="block text-xs font-medium mb-1 text-gray-700">Notes label (optional)</label>
              <Input
                type="text"
                value={form.systemFields?.notes?.label || ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    systemFields: {
                      ...(form.systemFields || {}),
                      notes: {
                        enabled: (form.systemFields?.notes?.enabled ?? true) === true,
                        label: e.target.value || undefined,
                        helpText: form.systemFields?.notes?.helpText,
                      },
                    },
                  })
                }
                placeholder="e.g., Dietary restrictions"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-gray-700">Notes help text (optional)</label>
              <Input
                type="text"
                value={form.systemFields?.notes?.helpText || ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    systemFields: {
                      ...(form.systemFields || {}),
                      notes: {
                        enabled: (form.systemFields?.notes?.enabled ?? true) === true,
                        label: form.systemFields?.notes?.label,
                        helpText: e.target.value || undefined,
                      },
                    },
                  })
                }
                placeholder="Short hint shown under the field"
              />
            </div>
          </div>
        )}

         <div className="mt-3 bg-green-50 border border-green-200 rounded-md p-3">
           <p className="text-xs text-green-800">
             Answers are automatically saved to your guest list (so you can filter/sort by them).
           </p>
         </div>
       </div>
 
       {/* Custom fields */}
       <div className="border rounded-md p-3">
         <h4 className="text-sm font-semibold text-gray-800 mb-2">Custom fields (from Guest Management)</h4>
         {!keys.length ? (
           <p className="text-xs text-gray-500">
             No guest custom fields found. Add custom columns in Guest Management first (CSV import/custom fields metadata), then you can map them into the RSVP form.
           </p>
         ) : (
           <div className="space-y-3">
             {keys.map((key) => {
               const existing = customFields.find((f) => f.key === key)
               const enabled = existing?.enabled === true
               const label = getDisplayLabel(customFieldsMetadata, key)
 
               return (
                 <div key={key} className="border border-gray-200 rounded-md p-3">
                   <div className="flex items-center justify-between gap-3">
                     <div className="min-w-0">
                       <p className="text-sm font-medium text-gray-900 truncate">{label}</p>
                       <p className="text-xs text-gray-500 truncate">{key}</p>
                     </div>
                     <input
                       type="checkbox"
                       checked={enabled}
                       onChange={(e) => {
                         if (!existing) {
                           upsertField({ key, enabled: e.target.checked, type: 'text', required: false })
                           return
                         }
                         upsertField({ ...existing, enabled: e.target.checked })
                       }}
                       className="w-4 h-4 text-eco-green focus:ring-eco-green border-gray-300 rounded"
                     />
                   </div>
 
                   {enabled && (
                     <div className="mt-3 space-y-2">
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                         <div>
                           <label className="block text-xs font-medium mb-1 text-gray-700">Field type</label>
                           <select
                             value={existing?.type || 'text'}
                             onChange={(e) => upsertField({ ...(existing as any), type: e.target.value as any })}
                             className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-eco-green text-sm"
                           >
                             <option value="text">Text</option>
                             <option value="number">Number</option>
                             <option value="select">Dropdown</option>
                             <option value="radio">Radio</option>
                             <option value="checkbox">Checkbox</option>
                           </select>
                         </div>
                         <div className="flex items-center justify-between sm:justify-start sm:gap-3">
                           <label className="text-xs font-medium text-gray-700">Required</label>
                           <input
                             type="checkbox"
                             checked={existing?.required === true}
                             onChange={(e) => upsertField({ ...(existing as any), required: e.target.checked })}
                             className="w-4 h-4 text-eco-green focus:ring-eco-green border-gray-300 rounded"
                           />
                         </div>
                       </div>
 
                       <div>
                         <label className="block text-xs font-medium mb-1 text-gray-700">Override label (optional)</label>
                         <Input
                           type="text"
                           value={existing?.label || ''}
                           onChange={(e) => upsertField({ ...(existing as any), label: e.target.value || undefined })}
                           placeholder={label}
                         />
                       </div>
 
                       <div>
                         <label className="block text-xs font-medium mb-1 text-gray-700">Help text (optional)</label>
                         <Input
                           type="text"
                           value={existing?.helpText || ''}
                           onChange={(e) => upsertField({ ...(existing as any), helpText: e.target.value || undefined })}
                           placeholder="Short hint shown under the field"
                         />
                       </div>
 
                       {(existing?.type === 'select' || existing?.type === 'radio') && (
                         <div>
                           <label className="block text-xs font-medium mb-1 text-gray-700">Options (one per line)</label>
                           <textarea
                             className="w-full min-h-[90px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-eco-green text-sm"
                             value={(existing?.options || []).map((o) => o.label).join('\\n')}
                             onChange={(e) => {
                               const lines = e.target.value
                                 .split('\\n')
                                 .map((s) => s.trim())
                                 .filter(Boolean)
                               const options: RsvpFieldOption[] = lines.map((v) => ({ label: v, value: v }))
                               upsertField({ ...(existing as any), options })
                             }}
                             placeholder={'Vegetarian\\nNon-Vegetarian\\nVegan'}
                           />
                           <p className="text-xs text-gray-500 mt-1">These will appear as choices to the guest.</p>
                         </div>
                       )}
                     </div>
                   )}
                 </div>
               )
             })}
           </div>
         )}
       </div>
     </div>
   )
 }

