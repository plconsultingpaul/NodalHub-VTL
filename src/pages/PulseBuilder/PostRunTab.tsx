import { Workflow } from 'lucide-react';

export default function PostRunTab() {
  return (
    <div className="max-w-3xl">
      <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-12 text-center">
        <div className="w-14 h-14 mx-auto bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Workflow className="w-7 h-7 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Post Run steps</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          Coming soon — call other APIs after the email is sent, passing data from the query.
        </p>
      </div>
    </div>
  );
}
