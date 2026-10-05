import bundleJSON from './bounded-model.json';
import domainJSON from './domain-model.json';
import { composeBoundedHeads, createBoundedHead, createDomainHead, type BoundedBundle } from './bounded-head';
export const boundedCorrection = composeBoundedHeads(createBoundedHead(bundleJSON as BoundedBundle), createDomainHead(domainJSON as BoundedBundle));
