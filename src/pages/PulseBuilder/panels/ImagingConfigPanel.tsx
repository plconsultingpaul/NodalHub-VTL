import { useMemo, useEffect, useRef, useState } from 'react';
import { ScanLine, Braces, Plus, Trash2, Download, Upload } from 'lucide-react';
import CustomDropdown from '../../../components/ui/CustomDropdown';
import { useImagingVendors } from '../../../hooks/useImagingVendors';
import { useQueries } from '../../../hooks/useQueries';
import type {
  PulseImagingStepConfig,
  PulseInputVariable,
  ImagingMappingSource,
  ImagingSendMetadataMapping,
  ImagingSendValueMapping,
} from '../../../types/database';

interface UpstreamQueryNode {
  id: string;
  label: string;
  queryId?: string;
  responseVariableName?: string;
  lastKnownColumns?: string[];
}

interface UpstreamReportNode {
  id: string;
  label: string;
  responseVariableName: string;
  type: 'run_report' | 'imaging';
}

interface ImagingConfigPanelProps {
  config: PulseImagingStepConfig | null;
  onChange: (config: PulseImagingStepConfig) => void;
  inputVariables?: PulseInputVariable[];
  upstreamQueryNodes?: UpstreamQueryNode[];
  upstreamReportNodes?: UpstreamReportNode[];
}

const MODE_OPTIONS = [
  { value: 'receive', label: 'Retrieve PDF from Imaging' },
  { value: 'send', label: 'Send PDF to Imaging' },
];

const LOOKUP_OPTIONS = [
  { value: 'bill_number', label: 'Bill Number' },
  { value: 'detail_line_id', label: 'Detail Line ID' },
];

const SOURCE_OPTIONS: { value: ImagingMappingSource; label: string }[] = [
  { value: 'hardcoded', label: 'Hardcoded' },
  { value: 'input_variable', label: 'Input Variable' },
  { value: 'query_column', label: 'Query Column' },
];

export default function ImagingConfigPanel({
  config,
  onChange,
  inputVariables = [],
  upstreamQueryNodes = [],
  upstreamReportNodes = [],
}: ImagingConfigPanelProps) {
  const { vendors, documentTypes, loading } = useImagingVendors();
  const { queries } = useQueries();

  const current: PulseImagingStepConfig = useMemo(
    () =>
      config || {
        stepType: 'imaging',
        name: '',
        stepName: '',
        mode: 'receive',
        vendorId: undefined,
        lookupBy: 'bill_number',
        documentTypeId: undefined,
        bucketId: undefined,
        attachmentFilename: '',
        responseVariableName: 'imaging_pdf',
        lookupMappings: [],
      },
    [config]
  );

  const mode = current.mode || 'receive';
  const vendor = vendors.find((v) => v.id === current.vendorId);
  const vendorDocTypes = documentTypes.filter((d) => d.vendor_id === current.vendorId);

  useEffect(() => {
    if (!config) onChange(current);
  }, [config]);

  const update = (patch: Partial<PulseImagingStepConfig>) => onChange({ ...current, ...patch });

  const vendorOptions = vendors.map((v) => ({ value: v.id, label: v.name }));
  const docTypeOptions = vendorDocTypes.map((d) => ({ value: d.remote_id, label: d.name }));

  const upstreamColumnOptions = useMemo(() => {
    const opts: { value: string; label: string; nodeId: string }[] = [];
    for (const n of upstreamQueryNodes) {
      const queryRecord = n.queryId ? queries.find((q) => q.id === n.queryId) : undefined;
      const raw = (queryRecord?.last_known_columns as unknown[] | undefined) || n.lastKnownColumns || [];
      const cols = Array.isArray(raw)
        ? raw.map((c) => (typeof c === 'string' ? c : (c as { name?: string })?.name)).filter((c): c is string => !!c)
        : [];
      for (const c of cols) {
        opts.push({ value: `${n.id}::${c}`, label: `${n.label} · ${c}`, nodeId: n.id });
      }
    }
    return opts;
  }, [upstreamQueryNodes, queries]);

  // ============ RECEIVE MODE ============

  const lookupMapping = current.lookupMappings.find((m) => m.field === current.lookupBy);
  const setLookupMapping = (
    patch: Partial<{ source: ImagingMappingSource; sourceValue: string; sourceNodeId?: string }>
  ) => {
    const existing = current.lookupMappings.filter((m) => m.field !== current.lookupBy);
    const next = {
      field: current.lookupBy,
      source: lookupMapping?.source || 'hardcoded',
      sourceValue: lookupMapping?.sourceValue || '',
      sourceNodeId: lookupMapping?.sourceNodeId,
      ...patch,
    };
    update({ lookupMappings: [...existing, next] });
  };

  // ============ SEND MODE ============

  const send = current.sendConfig || {};
  const updateSend = (patch: Partial<PulseImagingStepConfig['sendConfig']>) =>
    update({ sendConfig: { ...send, ...patch } });

  const filenameInputRef = useRef<HTMLInputElement | null>(null);
  const [showFilenameVars, setShowFilenameVars] = useState(false);

  const insertFilenameToken = (token: string) => {
    const input = filenameInputRef.current;
    const currentValue = send.originalFilename || '';
    if (input) {
      const start = input.selectionStart ?? currentValue.length;
      const end = input.selectionEnd ?? currentValue.length;
      const next = currentValue.slice(0, start) + token + currentValue.slice(end);
      updateSend({ originalFilename: next });
      requestAnimationFrame(() => {
        const el = filenameInputRef.current;
        if (el) {
          const pos = start + token.length;
          el.focus();
          el.setSelectionRange(pos, pos);
        }
      });
    } else {
      updateSend({ originalFilename: currentValue + token });
    }
    setShowFilenameVars(false);
  };

  const setBillMapping = (patch: Partial<ImagingSendValueMapping>) => {
    updateSend({
      billNumberMapping: {
        source: send.billNumberMapping?.source || 'hardcoded',
        sourceValue: send.billNumberMapping?.sourceValue || '',
        sourceNodeId: send.billNumberMapping?.sourceNodeId,
        ...patch,
      },
    });
  };

  const setDetailMapping = (patch: Partial<ImagingSendValueMapping>) => {
    updateSend({
      detailLineIdMapping: {
        source: send.detailLineIdMapping?.source || 'hardcoded',
        sourceValue: send.detailLineIdMapping?.sourceValue || '',
        sourceNodeId: send.detailLineIdMapping?.sourceNodeId,
        ...patch,
      },
    });
  };

  const metadataMappings = send.metadataMappings || [];
  const addMetadata = () =>
    updateSend({
      metadataMappings: [
        ...metadataMappings,
        { fieldName: '', source: 'hardcoded', sourceValue: '' },
      ],
    });
  const updateMetadata = (idx: number, patch: Partial<ImagingSendMetadataMapping>) => {
    const next = [...metadataMappings];
    next[idx] = { ...next[idx], ...patch };
    updateSend({ metadataMappings: next });
  };
  const removeMetadata = (idx: number) => {
    updateSend({ metadataMappings: metadataMappings.filter((_, i) => i !== idx) });
  };

  const changeMode = (newMode: 'receive' | 'send') => {
    if (newMode === 'send' && !send.sourcePdfNodeId && upstreamReportNodes.length > 0) {
      update({
        mode: newMode,
        bucketId: current.bucketId || vendor?.send_bucket_id || vendor?.default_bucket_id || undefined,
        documentTypeId: current.documentTypeId || (vendor?.send_default_document_type_id
          ? documentTypes.find((d) => d.id === vendor.send_default_document_type_id)?.remote_id
          : undefined) || undefined,
      });
    } else {
      update({ mode: newMode });
    }
  };

  const renderValueMappingRow = (
    m: { source: ImagingMappingSource; sourceValue: string; sourceNodeId?: string } | undefined,
    setter: (patch: Partial<ImagingSendValueMapping>) => void
  ) => {
    const src = m?.source || 'hardcoded';
    return (
      <div className="grid grid-cols-2 gap-2">
        <CustomDropdown
          value={src}
          onChange={(v) =>
            setter({ source: v as ImagingMappingSource, sourceValue: '', sourceNodeId: undefined })
          }
          options={SOURCE_OPTIONS}
        />
        {src === 'hardcoded' && (
          <input
            type="text"
            value={m?.sourceValue || ''}
            onChange={(e) => setter({ sourceValue: e.target.value })}
            placeholder="Value"
            className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        )}
        {src === 'input_variable' && (
          <CustomDropdown
            value={m?.sourceValue || ''}
            onChange={(v) => setter({ sourceValue: v })}
            options={inputVariables.map((iv) => ({ value: iv.name, label: iv.name }))}
            placeholder="Select input variable..."
          />
        )}
        {src === 'query_column' && (
          <CustomDropdown
            value={m?.sourceValue && m?.sourceNodeId ? `${m.sourceNodeId}::${m.sourceValue}` : ''}
            onChange={(v) => {
              const [nodeId, ...rest] = v.split('::');
              setter({ sourceNodeId: nodeId, sourceValue: rest.join('::') });
            }}
            options={upstreamColumnOptions.map((o) => ({ value: o.value, label: o.label }))}
            placeholder="Select column..."
          />
        )}
      </div>
    );
  };

  return (
    <div className="p-4 space-y-4 text-sm">
      <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
        <ScanLine className="w-4 h-4 text-cyan-500" />
        <h3 className="font-semibold text-gray-900 dark:text-white">Imaging Step</h3>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Step Name</label>
        <input
          type="text"
          value={current.stepName}
          onChange={(e) => update({ stepName: e.target.value, name: e.target.value })}
          placeholder={mode === 'send' ? 'Send Invoice to Imaging' : 'Fetch Invoice PDF'}
          className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Mode</label>
        <CustomDropdown
          value={mode}
          onChange={(v) => changeMode(v as 'receive' | 'send')}
          options={MODE_OPTIONS}
        />
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
          {mode === 'receive' ? (
            <><Download className="w-3 h-3" /> Retrieve an existing document from the vendor.</>
          ) : (
            <><Upload className="w-3 h-3" /> Send a PDF (from a Run Report step) into the vendor's Imaging system.</>
          )}
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Imaging Vendor</label>
        {loading ? (
          <div className="text-xs text-gray-400">Loading vendors...</div>
        ) : vendors.length === 0 ? (
          <div className="text-xs text-amber-600 dark:text-amber-400">
            No imaging vendors configured. Add one under Settings &gt; API Settings &gt; Imaging.
          </div>
        ) : (
          <CustomDropdown
            value={current.vendorId || ''}
            onChange={(v) => {
              const nextVendor = vendors.find((x) => x.id === v);
              const defaultDocRemoteId = nextVendor?.send_default_document_type_id
                ? documentTypes.find((d) => d.id === nextVendor.send_default_document_type_id)?.remote_id
                : undefined;
              update({
                vendorId: v,
                documentTypeId: mode === 'send' ? defaultDocRemoteId : undefined,
                bucketId:
                  mode === 'send'
                    ? nextVendor?.send_bucket_id || nextVendor?.default_bucket_id || undefined
                    : nextVendor?.default_bucket_id || undefined,
              });
            }}
            options={vendorOptions}
            placeholder="Select vendor..."
          />
        )}
      </div>

      {mode === 'receive' ? (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Lookup By</label>
            <CustomDropdown
              value={current.lookupBy}
              onChange={(v) => update({ lookupBy: v as 'bill_number' | 'detail_line_id' })}
              options={LOOKUP_OPTIONS}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Document Type</label>
            {docTypeOptions.length === 0 ? (
              <div className="text-xs text-gray-500 dark:text-gray-400 italic">
                {vendor ? 'No document types registered for this vendor.' : 'Select a vendor first.'}
              </div>
            ) : (
              <CustomDropdown
                value={current.documentTypeId || ''}
                onChange={(v) => update({ documentTypeId: v })}
                options={docTypeOptions}
                placeholder="Select document type..."
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Bucket ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={current.bucketId || ''}
              onChange={(e) => update({ bucketId: e.target.value })}
              placeholder="UUID of the imaging bucket"
              className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
            />
            {vendor?.default_bucket_id && !current.bucketId && (
              <button
                type="button"
                onClick={() => update({ bucketId: vendor.default_bucket_id || '' })}
                className="text-[11px] text-cyan-600 dark:text-cyan-400 hover:underline mt-1"
              >
                Use vendor default ({vendor.default_bucket_id})
              </button>
            )}
          </div>

          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
              {LOOKUP_OPTIONS.find((o) => o.value === current.lookupBy)?.label} Value
            </label>
            <div className="grid grid-cols-2 gap-2">
              <CustomDropdown
                value={lookupMapping?.source || 'hardcoded'}
                onChange={(v) => setLookupMapping({ source: v as ImagingMappingSource, sourceValue: '', sourceNodeId: undefined })}
                options={SOURCE_OPTIONS}
              />
              {(lookupMapping?.source || 'hardcoded') === 'hardcoded' && (
                <input
                  type="text"
                  value={lookupMapping?.sourceValue || ''}
                  onChange={(e) => setLookupMapping({ sourceValue: e.target.value })}
                  placeholder="Value"
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              )}
              {(lookupMapping?.source || 'hardcoded') === 'input_variable' && (
                <CustomDropdown
                  value={lookupMapping?.sourceValue || ''}
                  onChange={(v) => setLookupMapping({ sourceValue: v })}
                  options={inputVariables.map((iv) => ({ value: iv.name, label: iv.name }))}
                  placeholder="Select input variable..."
                />
              )}
              {(lookupMapping?.source || 'hardcoded') === 'query_column' && (
                <CustomDropdown
                  value={lookupMapping?.sourceValue && lookupMapping?.sourceNodeId ? `${lookupMapping.sourceNodeId}::${lookupMapping.sourceValue}` : ''}
                  onChange={(v) => {
                    const [nodeId, ...rest] = v.split('::');
                    setLookupMapping({ sourceNodeId: nodeId, sourceValue: rest.join('::') });
                  }}
                  options={upstreamColumnOptions.map((o) => ({ value: o.value, label: o.label }))}
                  placeholder="Select column..."
                />
              )}
            </div>
            {inputVariables.length === 0 && (lookupMapping?.source || 'hardcoded') === 'input_variable' && (
              <p className="text-[11px] text-gray-400 mt-1">No input variables defined on this pulse yet.</p>
            )}
          </div>

          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
              <Braces className="w-3 h-3" /> Response Variable Name
            </label>
            <input
              type="text"
              value={current.responseVariableName}
              onChange={(e) => update({ responseVariableName: e.target.value.replace(/[^a-zA-Z0-9_]/g, '_') })}
              placeholder="imaging_pdf"
              className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Downstream steps reference this as {`{{${current.responseVariableName || 'imaging_pdf'}}}`}.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Attachment Filename</label>
            <input
              type="text"
              value={current.attachmentFilename || ''}
              onChange={(e) => update({ attachmentFilename: e.target.value })}
              placeholder="Invoice_{{BILL_NUMBER}}.pdf"
              className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Supports {`{{variable}}`} tokens, {'{date}'}, and {'{pulse_name}'}. If the document isn't found, the workflow continues without an attachment.
            </p>
          </div>

          <div className="rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-2 text-[11px] text-amber-700 dark:text-amber-300">
            If the imaging vendor returns no document, this step logs a skip and the workflow continues to the next step.
          </div>
        </>
      ) : (
        <>
          {vendor && !vendor.send_api_key && (
            <div className="rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-2 text-[11px] text-amber-700 dark:text-amber-300">
              This vendor does not have a Send Ingest API Key configured. Add one under Settings &gt; API Settings &gt; Imaging.
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Source PDF</label>
            {upstreamReportNodes.length === 0 ? (
              <div className="text-xs text-amber-600 dark:text-amber-400">
                Add a Run Report step before this Imaging step so its PDF can be sent.
              </div>
            ) : (
              <CustomDropdown
                value={send.sourcePdfNodeId || ''}
                onChange={(v) => updateSend({ sourcePdfNodeId: v })}
                options={upstreamReportNodes.map((n) => ({
                  value: n.id,
                  label: `${n.label} (${n.responseVariableName})`,
                }))}
                placeholder="Select source PDF step..."
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Document Type</label>
            <input
              type="text"
              value={current.documentTypeId || ''}
              onChange={(e) => update({ documentTypeId: e.target.value })}
              placeholder="Enter the vendor's document-type ID (e.g. AR)"
              className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
            />
            {vendorDocTypes.length > 0 && (() => {
              const vendorBucketIds = new Set(
                [vendor?.send_bucket_id, vendor?.default_bucket_id].filter(Boolean) as string[]
              );
              const suspicious = vendorDocTypes.filter((d) => vendorBucketIds.has(d.remote_id));
              return (
                <div className="mt-1 space-y-1">
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Registered document types for this vendor (name &rarr; document-type ID):
                  </p>
                  <ul className="text-[11px] text-gray-500 dark:text-gray-400 pl-3 space-y-0.5">
                    {vendorDocTypes.map((d) => (
                      <li key={d.id} className="font-mono">
                        <span className="text-gray-700 dark:text-gray-300">{d.name}</span>
                        <span className="text-gray-400"> &rarr; </span>
                        <span>{d.remote_id}</span>
                      </li>
                    ))}
                  </ul>
                  {suspicious.length > 0 && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                      Warning: {suspicious.map((d) => d.name).join(', ')} {suspicious.length === 1 ? 'has a document-type ID' : 'have document-type IDs'} matching this vendor's bucket ID. Update the document-type registry under Settings &gt; API Settings &gt; Imaging so it stores the vendor's document-type UUID, not the bucket UUID.
                    </p>
                  )}
                </div>
              );
            })()}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Send Bucket ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={current.bucketId || ''}
              onChange={(e) => update({ bucketId: e.target.value })}
              placeholder="UUID of the target imaging bucket"
              className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
            />
            {vendor && (vendor.send_bucket_id || vendor.default_bucket_id) && !current.bucketId && (
              <button
                type="button"
                onClick={() => update({ bucketId: (vendor.send_bucket_id || vendor.default_bucket_id) as string })}
                className="text-[11px] text-cyan-600 dark:text-cyan-400 hover:underline mt-1"
              >
                Use vendor default ({vendor.send_bucket_id || vendor.default_bucket_id})
              </button>
            )}
          </div>

          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Bill Number</label>
            {renderValueMappingRow(send.billNumberMapping, setBillMapping)}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
              Detail Line ID <span className="text-gray-400">(optional)</span>
            </label>
            {renderValueMappingRow(send.detailLineIdMapping, setDetailMapping)}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Original Filename</label>
            <div className="relative flex items-stretch gap-1">
              <input
                ref={filenameInputRef}
                type="text"
                value={send.originalFilename || ''}
                onChange={(e) => updateSend({ originalFilename: e.target.value })}
                placeholder="BOL-{{BILL_NUMBER}}.pdf"
                className="flex-1 min-w-0 px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
              />
              <button
                type="button"
                onClick={() => {
                  if (inputVariables.length === 0 && upstreamColumnOptions.length === 0) return;
                  setShowFilenameVars((v) => !v);
                }}
                disabled={inputVariables.length === 0 && upstreamColumnOptions.length === 0}
                title={
                  inputVariables.length === 0 && upstreamColumnOptions.length === 0
                    ? 'No input variables or upstream query columns available'
                    : 'Insert an input variable or query column'
                }
                className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1.5 text-xs font-mono rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {'{ }'}
              </button>
              {showFilenameVars && (inputVariables.length > 0 || upstreamColumnOptions.length > 0) && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowFilenameVars(false)} />
                  <div className="absolute right-0 top-full mt-1 z-40 w-64 max-h-72 overflow-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg py-1">
                    {inputVariables.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
                          Insert Input Variable
                        </div>
                        {inputVariables.map((v) => (
                          <button
                            key={`iv-${v.name}`}
                            type="button"
                            onClick={() => insertFilenameToken(`{{${v.name}}}`)}
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-cyan-50 dark:hover:bg-cyan-900/20 flex items-center justify-between gap-2"
                          >
                            <span className="font-mono text-cyan-700 dark:text-cyan-300 truncate">{`{{${v.name}}}`}</span>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0">{v.dataType}</span>
                          </button>
                        ))}
                      </>
                    )}
                    {upstreamColumnOptions.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-t border-gray-100 dark:border-gray-700">
                          Insert Query Column
                        </div>
                        {upstreamColumnOptions.map((o) => {
                          const col = o.value.split('::')[1] || o.value;
                          return (
                            <button
                              key={`qc-${o.value}`}
                              type="button"
                              onClick={() => insertFilenameToken(`{{${col}}}`)}
                              className="w-full text-left px-3 py-1.5 text-xs hover:bg-cyan-50 dark:hover:bg-cyan-900/20 flex items-center justify-between gap-2"
                              title={o.label}
                            >
                              <span className="font-mono text-cyan-700 dark:text-cyan-300 truncate">{`{{${col}}}`}</span>
                              <span className="text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0 truncate max-w-[40%]">{o.label.split(' · ')[0]}</span>
                            </button>
                          );
                        })}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Supports {`{{variable}}`} input tokens, {`{{COLUMN}}`} query column tokens, {'{date}'}, and {'{pulse_name}'}. Defaults to the Run Report filename when blank.
            </p>
          </div>

          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Metadata</label>
              <button
                type="button"
                onClick={addMetadata}
                className="text-[11px] text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add field
              </button>
            </div>
            {metadataMappings.length === 0 ? (
              <p className="text-[11px] text-gray-400 italic">Unknown field names are silently dropped by the vendor.</p>
            ) : (
              <div className="space-y-2">
                {metadataMappings.map((m, idx) => (
                  <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded p-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={m.fieldName}
                        onChange={(e) => updateMetadata(idx, { fieldName: e.target.value })}
                        placeholder="field_name"
                        className="flex-1 px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => removeMetadata(idx)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {renderValueMappingRow(
                      { source: m.source, sourceValue: m.sourceValue, sourceNodeId: m.sourceNodeId },
                      (patch) => updateMetadata(idx, patch)
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
              <Braces className="w-3 h-3" /> Response Variable Name
            </label>
            <input
              type="text"
              value={current.responseVariableName}
              onChange={(e) => update({ responseVariableName: e.target.value.replace(/[^a-zA-Z0-9_]/g, '_') })}
              placeholder="imaging_ingest_result"
              className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              After a successful send, downstream steps can read <span className="font-mono">{`{{${current.responseVariableName || 'imaging_ingest_result'}}}`}</span> and its <span className="font-mono">imagingDocumentId</span>.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
