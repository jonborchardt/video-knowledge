import { datasetCsv, loadDatasets } from '../../../lib/datasets';
import { publicTopicNames } from '../../../lib/topics';

export function getStaticPaths() {
  return publicTopicNames().flatMap((topic) =>
    loadDatasets(topic).map((d) => ({ params: { topic, id: d.id }, props: { csv: datasetCsv(d) } })),
  );
}

export function GET({ props }: { props: { csv: string } }) {
  return new Response(props.csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8' } });
}
