/**
 * Surflux Flux Streams Integration
 * Real-time blockchain event streaming for Sui
 * 
 * Documentation: https://surflux.dev/docs/flux-streams/
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { PACKAGE_ID } from './contracts';

// ==================== CONFIG ====================

const SURFLUX_API_KEY = import.meta.env.VITE_SURFLUX_API_KEY;

// Flux endpoint for Testnet
const SURFLUX_FLUX_URL = 'https://testnet-flux.surflux.dev/events';
// For Mainnet: 'https://flux.surflux.dev/events'

// ==================== TYPES ====================

export interface SurfluxEvent {
  type: 'package_event' | 'address_update' | 'object_change';
  timestamp_ms: number;
  checkpoint_id: number;
  tx_hash: string;
  data: {
    event_type: string;
    sender: string;
    contents: Record<string, unknown>;
  };
}

export interface DocumentUploadedEvent {
  document_id: string;
  uploader: string;
  title: string;
  walrus_blob_id: string;
  category: string;
  timestamp: number;
}

export interface DocumentVotedEvent {
  document_id: string;
  voter: string;
  new_vote_count: number;
}

export type DocumentEventType = 'DocumentUploaded' | 'DocumentVoted';

export interface ParsedDocumentEvent {
  eventType: DocumentEventType;
  txHash: string;
  timestamp: number;
  data: DocumentUploadedEvent | DocumentVotedEvent;
}

// ==================== HOOKS ====================

/**
 * Surflux Flux Streams connection status
 */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * Generic Surflux Event Stream Hook
 * Listens to real-time blockchain events using SSE (Server-Sent Events)
 */
export function useSurfluxStream(options?: {
  onEvent?: (event: SurfluxEvent) => void;
  onError?: (error: Error) => void;
  enabled?: boolean;
  lastEventId?: string;
}) {
  const { onEvent, onError, enabled = true, lastEventId } = options || {};
  const eventSourceRef = useRef<EventSource | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [lastError, setLastError] = useState<Error | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);

  const connect = useCallback(() => {
    // API key check
    if (!SURFLUX_API_KEY || SURFLUX_API_KEY === 'your_surflux_api_key_here') {
      console.warn('[Surflux] API key not configured. Real-time updates disabled.');
      setStatus('disconnected');
      return;
    }


    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setStatus('connecting');

    // Create URL
    let url = `${SURFLUX_FLUX_URL}?api-key=${SURFLUX_API_KEY}`;
    if (lastEventId) {
      url += `&last-id=${lastEventId}`;
    }


    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setStatus('connected');
      setLastError(null);
      reconnectAttempts.current = 0;
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SurfluxEvent;
        onEvent?.(data);
      } catch (err) {
        console.error('[Surflux] Failed to parse event:', err);
      }
    };

    eventSource.onerror = (error) => {
      console.error('[Surflux] Connection error:', error);
      setStatus('error');
      const err = new Error('Surflux connection failed');
      setLastError(err);
      onError?.(err);
      
      // Auto-reconnect with exponential backoff
      eventSource.close();
      eventSourceRef.current = null;
      
      const backoff = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
      reconnectAttempts.current += 1;
      
      reconnectTimeoutRef.current = setTimeout(() => {
        if (enabled) {
          connect();
        }
      }, backoff);
    };
  }, [onEvent, onError, enabled, lastEventId]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setStatus('disconnected');
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    status,
    lastError,
    connect,
    disconnect,
    isConnected: status === 'connected',
  };
}

/**
 * Document Events Hook
 * Listens to DocumentUploaded and DocumentVoted events
 */
export function useDocumentEventStream(options?: {
  onDocumentUploaded?: (event: DocumentUploadedEvent, txHash: string) => void;
  onDocumentVoted?: (event: DocumentVotedEvent, txHash: string) => void;
  enabled?: boolean;
}) {
  const { onDocumentUploaded, onDocumentVoted, enabled = true } = options || {};
  const [recentEvents, setRecentEvents] = useState<ParsedDocumentEvent[]>([]);
  const processedTxHashes = useRef<Set<string>>(new Set());
  const isFirstConnection = useRef(true);

  const handleEvent = useCallback((event: SurfluxEvent) => {
    // Process only package_event
    if (event.type !== 'package_event') return;

    const eventType = event.data.event_type;
    
    // Check if event belongs to our package
    if (!eventType.includes(PACKAGE_ID)) return;

    // Do not process already processed event (duplicate prevention)
    if (processedTxHashes.current.has(event.tx_hash)) {
      return;
    }
    processedTxHashes.current.add(event.tx_hash);
    
    // Clean Set if it grows larger than 1000 elements
    if (processedTxHashes.current.size > 1000) {
      const entries = Array.from(processedTxHashes.current);
      processedTxHashes.current = new Set(entries.slice(-500));
    }

    const contents = event.data.contents as Record<string, unknown>;

    // DocumentUploaded event
    if (eventType.includes('DocumentUploaded')) {
      const uploadEvent: DocumentUploadedEvent = {
        document_id: contents.document_id as string,
        uploader: contents.uploader as string,
        title: contents.title as string,
        walrus_blob_id: contents.walrus_blob_id as string,
        category: contents.category as string,
        timestamp: Number(contents.timestamp || event.timestamp_ms),
      };

      
      setRecentEvents(prev => [{
        eventType: 'DocumentUploaded',
        txHash: event.tx_hash,
        timestamp: event.timestamp_ms,
        data: uploadEvent,
      }, ...prev.slice(0, 49)]); // Keep last 50 events

      // Do not call callback for old events on first connection
      if (!isFirstConnection.current) {
        onDocumentUploaded?.(uploadEvent, event.tx_hash);
      }
    }

    // DocumentVoted event
    if (eventType.includes('DocumentVoted')) {
      const voteEvent: DocumentVotedEvent = {
        document_id: contents.document_id as string,
        voter: contents.voter as string,
        new_vote_count: Number(contents.new_vote_count || 0),
      };

      
      setRecentEvents(prev => [{
        eventType: 'DocumentVoted',
        txHash: event.tx_hash,
        timestamp: event.timestamp_ms,
        data: voteEvent,
      }, ...prev.slice(0, 49)]);

      // Do not call callback for old events on first connection
      if (!isFirstConnection.current) {
        onDocumentVoted?.(voteEvent, event.tx_hash);
      }
    }
    
    // Set flag to false after first event processed (subsequent events are new)
    // With a small delay, to skip initial stream events
    setTimeout(() => {
      isFirstConnection.current = false;
    }, 2000);
  }, [onDocumentUploaded, onDocumentVoted]);

  const streamState = useSurfluxStream({
    onEvent: handleEvent,
    enabled,
  });

  return {
    ...streamState,
    recentEvents,
    clearEvents: () => {
      setRecentEvents([]);
      processedTxHashes.current.clear();
    },
  };
}

/**
 * Check if Surflux API key is configured
 */
export function isSurfluxConfigured(): boolean {
  return !!SURFLUX_API_KEY && SURFLUX_API_KEY !== 'your_surflux_api_key_here';
}
