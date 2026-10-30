// Public API of the storyboard module: the only file other capabilities (the board, the site, the article, the script CLI) may import.
export { buildStoryboard, pointProblems, renderStoryboardMd } from './storyboard';
export { type Bar, barGeometry, chartProblems, datasetChart } from './chart-geometry';
