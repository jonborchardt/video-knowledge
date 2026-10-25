import { loadDatasets } from '../../../lib/datasets';
import { publicTopicNames } from '../../../lib/topics';

export function getStaticPaths() {
  return publicTopicNames().flatMap((topic) =>
    loadDatasets(topic).map((d) => ({ params: { topic, id: d.id }, props: { table: d } })),
  );
}

export function GET({ props }: { props: { table: unknown } }) {
  return new Response(JSON.stringify(props.table, null, 2), { headers: { 'Content-Type': 'application/json' } });
}
