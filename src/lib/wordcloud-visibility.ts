/**
 * Slovní mrak je živý od otevření snímku. Skrytý je pouze tehdy, když ho učitel
 * výslovně skryl právě na tomto snímku; starší relace s `true` zůstávají viditelné.
 */
export function isWordcloudShown(settings: any, questionIndex: number): boolean {
  return !(
    settings?.wordcloudPublished === false &&
    settings?.wordcloudPublishedQuestion === questionIndex
  );
}
