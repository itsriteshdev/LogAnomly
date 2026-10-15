import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const socketRef = useRef(null);

  const connect = useCallback((token) => {
    if (socketRef.current?.connected) return;

    setConnecting(true);
    const socket = io('/', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      setConnected(true);
      setConnecting(false);
      socket.emit('subscribe:anomalies');
      socket.emit('subscribe:logs');
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      setConnecting(false);
      console.warn('Socket connection error:', err.message);
    });

    socket.on('anomaly:new', (anomaly) => {
      toast(`🚨 New ${anomaly.severity} anomaly detected: ${anomaly.serviceName || anomaly.sourceId}`, {
        icon: anomaly.severity === 'critical' ? '🔴' : '🟠',
        duration: 5000,
      });
    });

    socketRef.current = socket;
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setConnected(false);
    }
  }, []);

  const getSocket = useCallback(() => socketRef.current, []);

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return (
    <SocketContext.Provider value={{ connected, connecting, connect, disconnect, getSocket }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
