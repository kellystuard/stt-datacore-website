import React from 'react';

import { Estimate } from '../../../model/worker';
import { IProspectiveConfig, IProspectiveCrewSlot } from './model';

export interface IEditorContext {
	id: string;
	prospectiveConfig: IProspectiveConfig;
	prospectiveEstimate: Estimate | undefined;
	sortedSkills: string[];
	getConfigFromCrewSlots: (crewSlots: IProspectiveCrewSlot[]) => IProspectiveConfig;
	getRuntimeDiff: (altRuntime: number) => number;
	renderActions: () => JSX.Element;
	dismissEditor: () => void;
};

export const EditorContext = React.createContext<IEditorContext>({} as IEditorContext);
