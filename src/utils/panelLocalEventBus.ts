import { BusEvent, BusEventHandler, BusEventType, EventBus, EventFilterOptions } from '@grafana/data';
import { Observable, Unsubscribable, filter } from 'rxjs';

/**
 * Panel event bus that never delivers back the events this panel itself published.
 *
 * The deprecated `TimeSeries` / `GraphNG` we render from @grafana/ui still carries the
 * legacy cursor-sync subscriptions: it listens for `DataHoverEvent` and
 * `DataHoverClearEvent` on the panel event bus and moves the uPlot cursor in response.
 * Its clear handler does no origin check at all, so it also reacts to the panel's own
 * events. Grafana's current core GraphNG dropped those subscriptions and left the job to
 * `EventBusPlugin`; we render both, which closes a feedback loop:
 *
 *   EventBusPlugin publishes DataHoverClearEvent (cursor left the points)
 *     -> GraphNG receives its own event and calls setCursor(-10, -10)
 *     -> that fires uPlot's setLegend with no hovered index
 *     -> EventBusPlugin publishes another DataHoverClearEvent ... forever
 *
 * The loop free-runs at the publish throttle (~10 cursor resets per second) from the
 * first time the cursor leaves the points until the panel unmounts, and each reset kills
 * the tooltip about 100ms after it opens — a tooltip that blinks whenever the user
 * hovers a point again.
 *
 * Filtering self-published events out of the streams handed to the panel restores the
 * semantics core relies on (EventBusPlugin already ignores its own events) while leaving
 * publishing untouched, so shared crosshair/tooltip with other panels keeps working.
 */
export class PanelLocalEventBus implements EventBus {
  /** Events this panel published; identity is stable because the plugins reuse event objects. */
  private readonly published = new WeakSet<BusEvent>();

  constructor(private readonly bus: EventBus) {}

  publish<T extends BusEvent>(event: T): void {
    this.published.add(event);
    this.bus.publish(event);
  }

  getStream<T extends BusEvent>(eventType: BusEventType<T>): Observable<T> {
    return this.bus.getStream(eventType).pipe(filter((event) => !this.isSelfPublished(event)));
  }

  subscribe<T extends BusEvent>(eventType: BusEventType<T>, handler: BusEventHandler<T>): Unsubscribable {
    return this.getStream(eventType).subscribe({ next: handler });
  }

  removeAllListeners(): void {
    this.bus.removeAllListeners();
  }

  newScopedBus(key: string, filterOptions: EventFilterOptions): EventBus {
    return this.bus.newScopedBus(key, filterOptions);
  }

  private isSelfPublished(event: BusEvent): boolean {
    // `origin` is set by Grafana's ScopedEventBus on the first publish; the WeakSet covers
    // buses that leave it unset and events re-published by the dashboard's sync behaviour.
    return this.published.has(event) || event.origin === this.bus;
  }
}
