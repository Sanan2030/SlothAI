/** Entity metadata is local, reviewed, and independent of a network service. */
export type EntityType = 'country' | 'autonomous_republic' | 'city' | 'district' | 'region'
  | 'river' | 'sea' | 'lake' | 'mountain' | 'island' | 'street' | 'square'
  | 'monument' | 'person' | 'organization' | 'state_body' | 'political_party'
  | 'historical_event' | 'holiday' | 'calendar_event' | 'honorary_title'
  | 'state_symbol' | 'celestial_body' | 'religious_text' | 'position_title';
export type CapitalizationPolicy = 'all_lexical_words' | 'first_lexical_word'
  | 'geographic_generic_lower' | 'official_name' | 'contextual';
export type InflectionPolicy = 'none' | 'first_word' | 'last_word' | 'single_word';
export interface NamedEntity {
  id: string;
  canonical: string;
  type: EntityType;
  capitalizationPolicy: CapitalizationPolicy;
  inflectionPolicy: InflectionPolicy;
  aliases: readonly string[];
  /** Human-readable, pinned source identifier from sources.ts. */
  source: 'statistics-2025' | 'orthography-2019-2020' | 'reviewed-local';
}

export function namedEntity(canonical: string, type: EntityType, capitalizationPolicy: CapitalizationPolicy,
  inflectionPolicy: InflectionPolicy, source: NamedEntity['source'], aliases: readonly string[] = []): NamedEntity {
  return { id: `${type}:${canonical.toLocaleLowerCase('az-AZ').replace(/\s+/gu, '-')}`,
    canonical, type, capitalizationPolicy, inflectionPolicy, aliases, source };
}
