'use client';

import { useState, useEffect } from 'react';

interface ConnectionStatusProps {
  isRealtime: boolean;
  lastUpdate?: Date;
}

export default function ConnectionStatus({ isRealtime, lastUpdate }: ConnectionStatusProps) {
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor' | 'offline'>('good');
  const [timeSinceUpdate, setTimeSinceUpdate] = useState<number>(0);

  useEffect(() => {
    const interval = setInterval(() => {
      if (lastUpdate) {
        const seconds = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);
        setTimeSinceUpdate(seconds);

        // Determine connection quality based on time since last update
        if (isRealtime) {
          if (seconds < 2) setConnectionQuality('excellent');
          else if (seconds < 5) setConnectionQuality('good');
          else setConnectionQuality('poor');
        } else {
          // For polling, quality is based on expected poll interval
          if (seconds < 3) setConnectionQuality('good');
          else if (seconds < 10) setConnectionQuality('poor');
          else setConnectionQuality('offline');
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lastUpdate, isRealtime]);

  const getStatusColor = () => {
    switch (connectionQuality) {
      case 'excellent': return 'text-green-600 bg-green-100 border-green-300';
      case 'good': return 'text-blue-600 bg-blue-100 border-blue-300';
      case 'poor': return 'text-yellow-600 bg-yellow-100 border-yellow-300';
      case 'offline': return 'text-red-600 bg-red-100 border-red-300';
    }
  };

  const getStatusIcon = () => {
    if (connectionQuality === 'excellent') return '🟢';
    if (connectionQuality === 'good') return '🔵';
    if (connectionQuality === 'poor') return '🟡';
    return '🔴';
  };

  const getStatusText = () => {
    const mode = isRealtime ? 'Realtime' : 'Polling';
    const quality = connectionQuality === 'excellent' ? 'Excellent' :
                   connectionQuality === 'good' ? 'Good' :
                   connectionQuality === 'poor' ? 'Slow' : 'Offline';

    if (timeSinceUpdate > 0) {
      return `${mode} • ${quality} (${timeSinceUpdate}s ago)`;
    }
    return `${mode} • ${quality}`;
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg border text-sm font-medium ${getStatusColor()}`}>
      <span className="text-base">{getStatusIcon()}</span>
      <span>{getStatusText()}</span>
    </div>
  );
}