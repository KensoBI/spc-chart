import { DataHoverClearEvent, DataHoverEvent, EventBusSrv, FieldType, toDataFrame } from '@grafana/data';
import { CursorDomain, PanelLocalEventBus } from './panelLocalEventBus';

/** A hover event as EventBusPlugin publishes it: an X value plus the panel's aligned frame. */
function hoverFrom(domain: CursorDomain, time: number) {
  const x =
    domain === 'time'
      ? { name: 'time', type: FieldType.time, values: [time] }
      : { name: 'sample', type: FieldType.number, values: [time] };
  return new DataHoverEvent({
    point: { time },
    data: toDataFrame({ fields: [x, { name: 'value', type: FieldType.number, values: [1] }] }),
  });
}

describe('PanelLocalEventBus', () => {
  it('does not deliver back the events it published itself', () => {
    const panelBus = new EventBusSrv().newScopedBus('panel-1', { onlyLocal: false });
    const bus = new PanelLocalEventBus(panelBus, 'time');

    const received: string[] = [];
    bus.subscribe(DataHoverClearEvent, () => received.push('clear'));

    bus.publish(new DataHoverClearEvent());

    expect(received).toEqual([]);
  });

  it('still delivers events published by other panels', () => {
    const appBus = new EventBusSrv();
    const bus = new PanelLocalEventBus(appBus.newScopedBus('panel-1', { onlyLocal: false }), 'time');
    const otherPanel = appBus.newScopedBus('panel-2', { onlyLocal: false });

    const received: Array<number | null> = [];
    bus.subscribe(DataHoverEvent, (evt) => received.push(evt.payload.point.time));

    otherPanel.publish(new DataHoverEvent({ point: { time: 42 } }));

    expect(received).toEqual([42]);
  });

  it('publishes through to the wrapped bus so other panels still sync', () => {
    const appBus = new EventBusSrv();
    const bus = new PanelLocalEventBus(appBus.newScopedBus('panel-1', { onlyLocal: false }), 'time');

    const received: Array<number | null> = [];
    appBus.subscribe(DataHoverEvent, (evt) => received.push(evt.payload.point.time));

    bus.publish(new DataHoverEvent({ point: { time: 7 } }));

    expect(received).toEqual([7]);
  });

  it.each([
    ['time', 'numeric'],
    ['numeric', 'time'],
  ] as CursorDomain[][])('ignores a hover from a %s X-axis panel when plotting %s', (source, own) => {
    const appBus = new EventBusSrv();
    const bus = new PanelLocalEventBus(appBus.newScopedBus('panel-1', { onlyLocal: false }), own);
    const otherPanel = appBus.newScopedBus('panel-2', { onlyLocal: false });

    const received: Array<number | null> = [];
    bus.subscribe(DataHoverEvent, (evt) => received.push(evt.payload.point.time));

    otherPanel.publish(hoverFrom(source, 5));

    expect(received).toEqual([]);
  });

  it.each(['time', 'numeric'] as CursorDomain[])('accepts a hover from another %s X-axis panel', (domain) => {
    const appBus = new EventBusSrv();
    const bus = new PanelLocalEventBus(appBus.newScopedBus('panel-1', { onlyLocal: false }), domain);
    const otherPanel = appBus.newScopedBus('panel-2', { onlyLocal: false });

    const received: Array<number | null> = [];
    bus.subscribe(DataHoverEvent, (evt) => received.push(evt.payload.point.time));

    otherPanel.publish(hoverFrom(domain, 5));

    expect(received).toEqual([5]);
  });

  it('filters a republished event object, as the uPlot plugins reuse one instance', () => {
    const appBus = new EventBusSrv();
    const bus = new PanelLocalEventBus(appBus.newScopedBus('panel-1', { onlyLocal: false }), 'time');

    const received: string[] = [];
    bus.subscribe(DataHoverClearEvent, () => received.push('clear'));

    const clearEvent = new DataHoverClearEvent();
    bus.publish(clearEvent);
    // The dashboard's cursor-sync behaviour fans the same event back out to every panel.
    appBus.publish(clearEvent);

    expect(received).toEqual([]);
  });
});
