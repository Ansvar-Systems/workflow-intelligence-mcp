/** DFD element types used in stage-state schemas and validation rules. */

export interface DfdProcess {
  id: string; // proc-NNN
  name: string;
  description?: string;
}

export interface DfdDataStore {
  id: string; // ds-NNN
  name: string;
  data_classification?: "public" | "internal" | "confidential" | "restricted";
}

export interface DfdExternalEntity {
  id: string; // ext-NNN
  name: string;
  trust_level?: "trusted" | "semi_trusted" | "untrusted";
}

export interface DfdDataFlow {
  id: string; // df-NNN
  source_id: string;
  destination_id: string;
  data_description?: string;
  protocol?: string;
}

export interface DfdTrustBoundary {
  id: string; // tb-NNN
  name: string;
  enclosed_ids: string[];
}

export interface DfdStageState {
  processes: DfdProcess[];
  data_stores: DfdDataStore[];
  external_entities: DfdExternalEntity[];
  data_flows: DfdDataFlow[];
  trust_boundaries: DfdTrustBoundary[];
}
