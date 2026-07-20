import { forwardRef, useEffect, useImperativeHandle } from 'react';

type MapProps = { children?: React.ReactNode; onLoad?: () => void; onError?: () => void };
const MapMock = forwardRef(function MapMock({ children, onLoad, onError }: MapProps, ref) {
    useImperativeHandle(ref, () => ({ fitBounds: vi.fn(), flyTo: vi.fn(), getZoom: () => 9 }));
    useEffect(() => { onLoad?.(); }, [onLoad]);
    return <div data-testid="healthcare-map"><button type="button" onClick={onError}>Trigger map failure</button>{children}</div>;
});

export default MapMock;
export function Source({ id, children }: { id: string; children?: React.ReactNode }) { return <div data-testid={`source-${id}`}>{children}</div>; }
export function Layer({ id }: { id: string }) { return <span data-testid={`layer-${id}`} />; }
export function Marker({ children }: { children?: React.ReactNode }) { return <div>{children}</div>; }
export function NavigationControl() { return null; }
export function FullscreenControl() { return null; }
