import { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Bug } from "lucide-react";
import { cn } from "@/lib/utils";

interface DebugPanelProps {
  title?: string;
  model?: string;
  status?: string;
  endpoint?: string;
  timestamp?: string;
  requestPayload?: any;
  responseData?: any;
  formData?: any;
  error?: any;
  className?: string;
}

export default function DebugPanel({
  title = "Debug Information",
  model,
  status = "idle",
  endpoint,
  timestamp,
  requestPayload,
  responseData,
  formData,
  error,
  className
}: DebugPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatTimestamp = (ts?: string) => {
    if (!ts) return new Date().toLocaleTimeString();
    return new Date(ts).toLocaleTimeString();
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'sending':
      case 'loading':
      case 'pending':
        return 'text-orange-600';
      case 'success':
      case 'completed':
        return 'text-green-600';
      case 'error':
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <Card className={cn("border border-gray-200 bg-gray-50", className)}>
      <Button
        variant="ghost"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full justify-start p-4 h-auto hover:bg-gray-100"
      >
        <div className="flex items-center gap-2 text-left">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <Bug className="h-4 w-4 text-gray-600" />
          <span className="font-medium text-gray-700">{title}</span>
        </div>
      </Button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Status Information */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            {model && (
              <div>
                <span className="font-medium text-gray-600">Model:</span>{' '}
                <span className="text-gray-800">{model}</span>
              </div>
            )}
            <div>
              <span className="font-medium text-gray-600">Status:</span>{' '}
              <span className={getStatusColor(status)}>{status}</span>
            </div>
            {endpoint && (
              <div>
                <span className="font-medium text-gray-600">Endpoint:</span>{' '}
                <span className="text-gray-800">{endpoint}</span>
              </div>
            )}
            <div>
              <span className="font-medium text-gray-600">Timestamp:</span>{' '}
              <span className="text-gray-800">{formatTimestamp(timestamp)}</span>
            </div>
          </div>

          {/* Request Payload */}
          {requestPayload && (
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Request Payload:</h4>
              <pre className="bg-white border rounded p-3 text-xs overflow-x-auto text-gray-800 font-mono">
{JSON.stringify(requestPayload, null, 2)}
              </pre>
            </div>
          )}

          {/* Response Data */}
          {responseData && (
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Response Data:</h4>
              <pre className="bg-white border rounded p-3 text-xs overflow-x-auto text-gray-800 font-mono">
{JSON.stringify(responseData, null, 2)}
              </pre>
            </div>
          )}

          {/* Form Data */}
          {formData && (
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Form Data:</h4>
              <pre className="bg-white border rounded p-3 text-xs overflow-x-auto text-gray-800 font-mono">
{JSON.stringify(formData, null, 2)}
              </pre>
            </div>
          )}

          {/* Error Information */}
          {error && (
            <div>
              <h4 className="font-medium text-red-700 mb-2">Error Details:</h4>
              <pre className="bg-red-50 border border-red-200 rounded p-3 text-xs overflow-x-auto text-red-800 font-mono">
{JSON.stringify(error, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}