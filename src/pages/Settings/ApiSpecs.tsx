import { useState, useRef } from 'react';
import { useEndpoints } from '../../hooks/useEndpoints';
import { useApiSpecs } from '../../hooks/useApiSpecs';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';
import CustomDropdown from '../../components/ui/CustomDropdown';
import Modal from '../../components/ui/Modal';
import ApiSpecViewerModal from '../../components/ApiSpecViewerModal';
import { FileText, Upload, Eye, Download, Trash2 } from 'lucide-react';
import type { ApiSpecWithEndpoint } from '../../types/database';

export default function ApiSpecs() {
  const { endpoints } = useEndpoints();
  const { specs, loading, uploadSpec, deleteSpec, downloadSpec } = useApiSpecs();
  const { activeCompany } = useAuth();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedEndpointId, setSelectedEndpointId] = useState('');
  const [filterEndpointId, setFilterEndpointId] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewingSpec, setViewingSpec] = useState<ApiSpecWithEndpoint | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string; name: string } | null>(null);

  const canEdit = activeCompany?.role === 'Admin';

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validExtensions = ['.json', '.yaml', '.yml'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validExtensions.includes(fileExtension)) {
      setUploadError('Invalid file type. Please upload a JSON or YAML file.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File too large. Maximum size is 10MB.');
      return;
    }

    setUploading(true);
    setUploadError('');

    const result = await uploadSpec(file, selectedEndpointId || null);

    setUploading(false);

    if (result.error) {
      setUploadError(result.error);
    } else {
      setShowUploadModal(false);
      setSelectedEndpointId('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteSpec = (spec: ApiSpecWithEndpoint) => {
    setDeleteConfirmation({ id: spec.id, name: spec.name });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmation) return;
    await deleteSpec(deleteConfirmation.id);
    setDeleteConfirmation(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
  };

  const filteredSpecs = filterEndpointId
    ? specs.filter(s => s.api_endpoint_id === filterEndpointId)
    : specs;

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">API Specs</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Upload and manage Swagger/OpenAPI specifications
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="min-w-[180px]">
              <CustomDropdown
                value={filterEndpointId}
                onChange={(val) => setFilterEndpointId(val)}
                options={[
                  { value: '', label: 'All Endpoints' },
                  ...endpoints.map((ep) => ({ value: ep.id, label: ep.name }))
                ]}
              />
            </div>
            {canEdit && (
              <Button onClick={() => setShowUploadModal(true)}>
                <Upload className="w-4 h-4" />
                Upload Spec
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-8 flex justify-center">
            <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredSpecs.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No API specifications</h3>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">
              Upload a Swagger or OpenAPI specification to get started.
            </p>
            {canEdit && (
              <Button onClick={() => setShowUploadModal(true)}>
                <Upload className="w-4 h-4" />
                Upload Your First Spec
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredSpecs.map((spec) => (
              <div key={spec.id} className="px-6 py-4 flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900 dark:text-white">{spec.name}</h3>
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-teal-100 text-teal-700">
                        v{spec.version}
                      </span>
                    </div>
                    {spec.api_endpoints && (
                      <div className="mt-1">
                        <span className="text-sm text-gray-500">
                          Linked to: {spec.api_endpoints.name}
                        </span>
                      </div>
                    )}
                    <div className="mt-1 text-xs text-gray-500">
                      {spec.file_name} - Uploaded: {formatDate(spec.uploaded_at)} - {spec.endpoint_count} endpoints
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setViewingSpec(spec)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="View"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => downloadSpec(spec)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Download"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => handleDeleteSpec(spec)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setSelectedEndpointId('');
          setUploadError('');
        }}
        title="Upload API Specification"
        size="md"
      >
        <div className="space-y-4">
          {uploadError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {uploadError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API Endpoint (Optional)</label>
            <CustomDropdown
              value={selectedEndpointId}
              onChange={(val) => setSelectedEndpointId(val)}
              options={[
                { value: '', label: 'Select an API endpoint...' },
                ...endpoints.map((ep) => ({ value: ep.id, label: ep.name }))
              ]}
              placeholder="Select an API endpoint..."
            />
            <p className="mt-1 text-xs text-gray-500">Link this spec to a configured API endpoint</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Specification File</label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-gray-400 transition-colors">
              <div className="space-y-1 text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <div className="flex text-sm text-gray-600">
                  <label
                    htmlFor="spec-file-upload"
                    className="relative cursor-pointer rounded-md font-medium text-black hover:text-gray-800 focus-within:outline-none"
                  >
                    <span>Upload a file</span>
                    <input
                      id="spec-file-upload"
                      name="spec-file-upload"
                      type="file"
                      className="sr-only"
                      accept=".json,.yaml,.yml"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">JSON or YAML up to 10MB</p>
              </div>
            </div>
          </div>

          {uploading && (
            <div className="flex items-center justify-center gap-2 py-2">
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-gray-600">Uploading and parsing spec...</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button variant="secondary" onClick={() => {
              setShowUploadModal(false);
              setSelectedEndpointId('');
              setUploadError('');
            }}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {viewingSpec && (
        <ApiSpecViewerModal
          spec={viewingSpec}
          onClose={() => setViewingSpec(null)}
          onDownload={downloadSpec}
        />
      )}

      <Modal
        isOpen={!!deleteConfirmation}
        onClose={() => setDeleteConfirmation(null)}
        title="Confirm Deletion"
        size="md"
      >
        {deleteConfirmation && (
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-red-50 dark:bg-red-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Delete API Specification?
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  You're about to permanently delete <span className="font-semibold text-gray-900 dark:text-white">{deleteConfirmation.name}</span>.
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  This will permanently remove the API specification file from your workspace.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button variant="secondary" onClick={() => setDeleteConfirmation(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleConfirmDelete}>
                <Trash2 className="w-4 h-4" />
                Delete Specification
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
