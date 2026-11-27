import { TreeDecorator } from '../../src/backend';
import type { PluginContributions, ShapeView, TreeSuccess } from '../../src/backend';

interface Snapshot {
  readonly canvas: string;
  readonly rows: ReadonlyMap<string, string>;
}

function snapshot({ canvas, nodes }: TreeSuccess): Snapshot {
  const rows = new Map<string, string>();
  const visit = (shapes: readonly ShapeView[], parent: string | null): void => {
    shapes.forEach((shape, index) => {
      rows.set(shape.id, JSON.stringify([
        shape.type, shape.attributes, shape.content, parent, index, shape.children.map((child) => child.id),
      ]));
      visit(shape.children, shape.id);
    });
  };
  visit(nodes, null);
  return { canvas: JSON.stringify(canvas), rows };
}

export class ModifiedStar extends TreeDecorator {
  static override readonly decoratorName = 'modified-star';

  private baseline: Snapshot | null = null;
  private dirtyRows = new Set<string>();
  private dirtyCanvas = false;

  protected override tag(node: ShapeView | null): string | null {
    const dirty = node === null ? this.dirtyCanvas : this.dirtyRows.has(node.id);
    return dirty ? '*' : null;
  }

  override onSuccess(event: TreeSuccess): void {
    const current = snapshot(event);
    if (event.kind === 'save' || event.kind === 'replace') {
      this.baseline = current;
      this.dirtyRows.clear();
      this.dirtyCanvas = false;
      return;
    }

    const baseline = this.baseline;
    this.dirtyRows = new Set(
      [...current.rows].filter(([id, value]) => baseline?.rows.get(id) !== value).map(([id]) => id),
    );
    this.dirtyCanvas = this.dirtyRows.size > 0 || current.rows.size !== baseline?.rows.size ||
      current.canvas !== baseline?.canvas;
  }
}

export default function activate(): PluginContributions {
  return { shapes: [], commands: [], attributes: [], decorators: [ModifiedStar] };
}
