import { datasetCsv, dataRef, loadDatasets } from '../../../modules/evidence';
import { siteGraph } from '../../../modules/website/site-graph';
import { publicTopicNames } from '../../../modules/evidence';

export function getStaticPaths() {
  const g = siteGraph();
  return publicTopicNames().flatMap((topic) =>
    loadDatasets(topic)
      .filter((d) => g.nodes.get(dataRef(topic, d.id))?.public)
      .map((d) => ({ params: { topic, id: d.id }, props: { csv: datasetCsv(d) } })),
  );
}

export function GET({ props }: { props: { csv: string } }) {
  return new Response(props.csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8' } });
}
