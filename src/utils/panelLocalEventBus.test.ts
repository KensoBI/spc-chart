import { DataHoverClearEvent, DataHoverEvent, EventBusSrv } from '@grafana/data';
import { PanelLocalEventBus } from './panelLocalEventBus';

describe('PanelLocalEventBus', () => {
  it('does not deliver back the events it published itself', () => {
    const panelBus = new EventBusSrv().newScopedBus('panel-1', { onlyLocal: false });
    const bus = new PanelLocalEventBus(panelBus);

    const received: string[] = [];
    bus.subscribe(DataHoverClearEvent, () => received.push('clear'));

    bus.publish(new DataHoverClearEvent());

    expect(received).toEqual([]);
  });

  it('still delivers events published by other panels', () => {
    const appBus = new EventBusSrv();
    const bus = new PanelLocalEventBus(appBus.newScopedBus('panel-1', { onlyLocal: false }));
    const otherPanel = appBus.newScopedBus('panel-2', { onlyLocal: false });

    const received: Array<number | null> = [];
    bus.subscribe(DataHoverEvent, (evt) => received.push(evt.payload.point.time));

    otherPanel.publish(new DataHoverEvent({ point: { time: 42 } }));

    expect(received).toEqual([42]);
  });

  it('publishes through to the wrapped bus so other panels still sync', () => {
    const appBus = new EventBusSrv();
    const bus = new PanelLocalEventBus(appBus.newScopedBus('panel-1', { onlyLocal: false }));

    const received: Array<number | null> = [];
    appBus.subscribe(DataHoverEvent, (evt) => received.push(evt.payload.point.time));

    bus.publish(new DataHoverEvent({ point: { time: 7 } }));

    expect(received).toEqual([7]);
  });

  it('filters a republished event object, as the uPlot plugins reuse one instance', () => {
    const appBus = new EventBusSrv();
    const bus = new PanelLocalEventBus(appBus.newScopedBus('panel-1', { onlyLocal: false }));

    const received: string[] = [];
    bus.subscribe(DataHoverClearEvent, () => received.push('clear'));

    const clearEvent = new DataHoverClearEvent();
    bus.publish(clearEvent);
    // The dashboard's cursor-sync behaviour fans the same event back out to every panel.
    appBus.publish(clearEvent);

    expect(received).toEqual([]);
  });
});
