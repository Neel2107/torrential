import { createContext, use, useEffect, useId, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

type Host = { mount: (id: string, node: ReactNode) => void; unmount: (id: string) => void };

const Context = createContext<Host | null>(null);

export function PortalHost({ children }: { children: ReactNode }) {
  const [nodes, setNodes] = useState<Map<string, ReactNode>>(new Map());
  const [host] = useState<Host>(() => ({
    mount: (id, node) => setNodes((previous) => new Map(previous).set(id, node)),
    unmount: (id) =>
      setNodes((previous) => {
        const next = new Map(previous);
        next.delete(id);
        return next;
      }),
  }));

  return (
    <Context value={host}>
      {children}
      {nodes.size > 0 ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {[...nodes.entries()].map(([id, node]) => (
            <View key={id} style={StyleSheet.absoluteFill} pointerEvents="box-none">
              {node}
            </View>
          ))}
        </View>
      ) : null}
    </Context>
  );
}

export function Portal({ children }: { children: ReactNode }) {
  const host = use(Context);
  const id = useId();

  useEffect(() => {
    host?.mount(id, children);
  });

  useEffect(() => () => host?.unmount(id), [host, id]);

  return host ? null : children;
}
