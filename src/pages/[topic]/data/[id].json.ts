import { dataRef, loadDatasets } from '../../../lib/datasets';
import { siteGraph } from '../../../modules/website/site-graph';
import { publicTopicNames } from '../../../lib/topics';

export function getStaticPaths() {
  const g = siteGraph();
  return publicTopicNames().flatMap((topic) =>
    loadDatasets(topic)
      .filter((d) => g.nodes.get(dataRef(topic, d.id))?.public)
      .map((d) => ({ params: { topic, id: d.id }, props: { table: d } })),
  );
}

export function GET({ props }: { props: { table: unknown } }) {
  return new Response(JSON.stringify(props.table, null, 2), { headers: { 'Content-Type': 'application/json' } });
}
