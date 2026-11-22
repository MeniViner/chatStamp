/** Metro resolves bundled images to an asset id. */
declare module '*.png' {
  const asset: number;
  export default asset;
}
