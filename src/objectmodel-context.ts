import _OM from '@duet3d/objectmodel';
import { setMachineContext } from '@duet3d/monacotokens/dist/objectmodel/machine-context';

// CJS interop: Vite maps the entire module.exports as the ESM default.
// The actual class lives at .default of that object (fallback if already unwrapped).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ObjectModel = ((_OM as any).default ?? _OM) as typeof _OM;

/**
 * Install a static RRF object model context so Monaco's completion providers
 * can enumerate object model members without a live machine connection.
 * Each ModelCollection is seeded with one representative default instance so
 * that paths like `{move.axes[0].` and `{boards[0].` resolve to actual members.
 *
 * Note: In RRF expression syntax arrays have no dotted members — access items
 * via index: `{boards[0].canAddress}`, not `{boards.canAddress}`.
 */
export function installStaticObjectModelContext(): void {
    const model = new ObjectModel();

    // ---- top-level collections ----
    model.boards.push({} as never);
    model.fans.push({} as never);
    model.inputs.push({} as never);
    model.ledStrips.push({} as never);
    model.messages.push({} as never);
    model.spindles.push({} as never);
    model.tools.push({} as never);
    model.volumes.push({} as never);

    // ---- move sub-collections ----
    model.move.axes.push({} as never);
    model.move.extruders.push({} as never);
    model.move.keepout.push({} as never);
    model.move.queue.push({} as never);

    // ---- heat sub-collections ----
    model.heat.heaters.push({} as never);

    // ---- sensors sub-collections ----
    model.sensors.analog.push({} as never);
    model.sensors.endstops.push({} as never);
    model.sensors.filamentMonitors.push({} as never);
    model.sensors.gpIn.push({} as never);
    model.sensors.probes.push({} as never);

    // ---- network sub-collections ----
    model.network.interfaces.push({} as never);

    setMachineContext({ model });
}
