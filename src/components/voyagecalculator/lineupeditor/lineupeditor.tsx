import React from 'react';
import {
	Button,
	Dimmer,
	Loader
} from 'semantic-ui-react';

import CONFIG from '../../CONFIG';

import { PlayerCrew } from '../../../model/player';
import { Ship } from '../../../model/ship';
import { Estimate, IVoyageCalcConfig } from '../../../model/voyage';

import { CalculatorContext } from '../context';

import { IControlVoyage, IProspectiveConfig, IProspectiveCrewSlot } from './model';
import { EditorContext, IEditorContext } from './context';
import { AlternateCrewPicker } from './crewpicker';
import { AlternateSlotPicker } from './slotpicker';
import { ProspectiveSummary } from './summary';
import { getProspectiveConfig } from './utils';

export interface ILineupEditorTrigger {
	view: LineupEditorViews;
};

type LineupEditorViews = 'crewpicker' | 'slotpicker' | 'summary';

type LineupEditorProps = {
	id: string;
	trigger: ILineupEditorTrigger | undefined;
	cancelTrigger: () => void;
	ship?: Ship;
	control?: IControlVoyage;
	commitVoyage: (config: IVoyageCalcConfig, ship: Ship, estimate: Estimate) => void;
};

export const LineupEditor = (props: LineupEditorProps) => {
	const { voyageConfig } = React.useContext(CalculatorContext);
	const { trigger, cancelTrigger, ship, control, commitVoyage } = props;

	const [prospectiveCrewSlots, setProspectiveCrewSlots] = React.useState<IProspectiveCrewSlot[] | undefined>(control?.config.crew_slots);
	const [prospectiveEstimate, setProspectiveEstimate] = React.useState<Estimate | undefined>(control?.estimate);
	const [activeView, setActiveView] = React.useState<LineupEditorViews | undefined>(undefined);
	const [alternateCrew, setAlternateCrew] = React.useState<PlayerCrew | undefined>(undefined);

	React.useEffect(() => {
		setActiveView(trigger?.view);
	}, [trigger]);

	const prospectiveConfig = React.useMemo<IProspectiveConfig>(() => {
		if (prospectiveCrewSlots)
			return getConfigFromCrewSlots(prospectiveCrewSlots);

		const crewSlots: IProspectiveCrewSlot[] = [];
		voyageConfig.crew_slots.forEach(cs => {
			crewSlots.push({...cs, crew: undefined});
		});
		return getConfigFromCrewSlots(crewSlots);
	}, [voyageConfig, prospectiveCrewSlots]);

	const sortedSkills = React.useMemo<string[]>(() => {
		const sortedSkills: string[] = [
			voyageConfig.skills.primary_skill,
			voyageConfig.skills.secondary_skill
		];
		Object.keys(CONFIG.SKILLS).filter(skill =>
			skill !== voyageConfig.skills.primary_skill
				&& skill !== voyageConfig.skills.secondary_skill
		).forEach(otherSkill => {
			sortedSkills.push(otherSkill);
		});
		return sortedSkills;
	}, [voyageConfig]);

	if (!trigger) return <></>;

	const editorContext: IEditorContext = {
		id: props.id,
		prospectiveConfig,
		prospectiveEstimate,
		sortedSkills,
		getConfigFromCrewSlots,
		getRuntimeDiff,
		renderActions,
		dismissEditor
	};

	return (
		<EditorContext.Provider value={editorContext}>
			<React.Fragment>
				{activeView === 'crewpicker' && (
					<AlternateCrewPicker
						setAlternate={seekSeatForAlternate}
					/>
				)}
				{activeView === 'slotpicker' && alternateCrew && (
					<AlternateSlotPicker
						alternateCrew={alternateCrew}
						setAlternateVoyage={updateProspectiveVoyage}
					/>
				)}
				{activeView === 'summary' && (
					<ProspectiveSummary
						control={control}
						saveVoyage={saveVoyage}
						resetVoyage={resetVoyage}
					/>
				)}
				{!activeView && (
					<Dimmer active page>
						<Loader indeterminate />
					</Dimmer>
				)}
			</React.Fragment>
		</EditorContext.Provider>
	);

	function getConfigFromCrewSlots(crewSlots: IProspectiveCrewSlot[]): IProspectiveConfig {
		return getProspectiveConfig(voyageConfig, ship, crewSlots);
	}

	function getRuntimeDiff(altRuntime: number): number {
		if (!prospectiveEstimate) return 0;
		return altRuntime - prospectiveEstimate.refills[0].result;
	}

	function renderActions(): JSX.Element {
		return (
			<React.Fragment>
				{activeView !== 'summary' && (
					<Button	/* View prospective voyage */
						title='View prospective voyage'
						icon='vcard'
						onClick={() => {
							setAlternateCrew(undefined);
							setActiveView('summary');
						}}
					/>
				)}
				{activeView !== 'crewpicker' && (
					<Button	/* Search for alternate crew */
						title='Search for alternate crew'
						icon='search'
						onClick={() => {
							setAlternateCrew(undefined);
							setActiveView('crewpicker');
						}}
					/>
				)}
				<Button	/* Close */
					content='Close'
					onClick={dismissEditor}
				/>
			</React.Fragment>
		);
	}

	function dismissEditor(): void {
		setActiveView(undefined);
		setAlternateCrew(undefined);
		cancelTrigger();
	}

	function seekSeatForAlternate(alternateCrew: PlayerCrew): void {
		setAlternateCrew(alternateCrew);
		setActiveView('slotpicker');
	}

	function updateProspectiveVoyage(config: IProspectiveConfig, estimate: Estimate): void {
		setProspectiveCrewSlots(config.crew_slots);
		setProspectiveEstimate(estimate);
		setAlternateCrew(undefined);
		setActiveView('summary');
	}

	function saveVoyage(): void {
		if (!ship || !prospectiveEstimate) return;
		commitVoyage(prospectiveConfig as IVoyageCalcConfig, ship, prospectiveEstimate);
		dismissEditor();
	}

	function resetVoyage(): void {
		if (!control) return;
		setProspectiveCrewSlots(control.config.crew_slots);
		setProspectiveEstimate(control.estimate);
	}
};
