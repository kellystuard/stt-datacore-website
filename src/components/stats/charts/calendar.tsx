import React from "react"
import { GlobalContext } from "../../../context/globalcontext"
import { StatsContext } from "../dataprovider";
import { useStateWithStorage } from "../../../utils/storage";
import { EpochDiff, GraphPropsCommon, Highs } from "../model";
import { epochToDate, filterEpochDiffs, filterHighs, findHigh, GameEpoch, isoDatePart, OptionsPanelFlexColumn, OptionsPanelFlexRow } from "../utils";
import { CalendarDatum, ResponsiveCalendar } from "@nivo/calendar";
import { skillSum } from "../../../utils/crewutils";
import themes from "../../nivo_themes";
import { CrewMember } from "../../../model/crew";
import { CrewTiles } from "../../base/crewtiles";
import { Checkbox, Label } from "semantic-ui-react";

interface CalendarData extends CalendarDatum {
    year: number;
    value: number;
    day: string;
    highs: Highs[],
    entries: number;
    rarities: number[];
    symbols: string[];
    diffs: number[];
    epoch_day: number;
    crew: CrewMember[];
}



export const StatsCalendarChart = (props: GraphPropsCommon) => {
    const { useFilters } = props;
    const globalContext = React.useContext(GlobalContext);
    const statsContext = React.useContext(StatsContext);
    const { t } = globalContext.localized;
    const { crew } = globalContext.core;
    const { filterConfig, allHighs: outerHighs, epochDiffs: outerDiffs } = statsContext;

    const [allHighs, setAllHighs] = React.useState<Highs[]>([]);
    const [epochDiffs, setEpochDiffs] = React.useState<EpochDiff[]>([]);
    const [releaseTable, setReleaseTable] = React.useState<CalendarData[]>([]);

    const totalYears = (((new Date()).getUTCFullYear()) - GameEpoch.getUTCFullYear()) + 1;

    React.useEffect(() => {
        if (outerHighs.length) {
            if (useFilters) {
                setAllHighs(filterHighs(filterConfig, outerHighs));
            }
            else {
                setAllHighs(outerHighs);
            }
        }
    }, [useFilters, filterConfig, outerHighs]);

    React.useEffect(() => {
        if (outerDiffs.length) {
            if (useFilters) {
                setEpochDiffs(filterEpochDiffs(filterConfig, outerDiffs))
            }
            else {
                setEpochDiffs(outerDiffs);
            }
        }
    }, [useFilters, filterConfig, outerDiffs]);

    React.useEffect(() => {
        if (!epochDiffs.length) return;
        if (!allHighs.length) return;

        const newYears = [] as CalendarData[][];
        const now = new Date();
        const startYear = GameEpoch.getUTCFullYear();
        const endYear = now.getUTCFullYear();

        for (let year = startYear; year <= endYear; year++) {
            const newData = [] as CalendarData[];
            const filtered = epochDiffs.filter(f => f.epoch_days.some(ed => epochToDate(ed).getUTCFullYear() === year));

            for (let diff of filtered) {
                for (let i = 0; i < 2; i++) {
                    let d = epochToDate(diff.epoch_days[i]);
                    if (d.getUTCFullYear() !== year) continue;

                    let c = crew.find(f => f.symbol === diff.symbols[i])!;
                    let skillsum = skillSum(Object.values(c.base_skills), 'all', false) / c.skill_order.length;

                    let iso = isoDatePart(d);
                    let curr = newData.find(f => f.day === iso);
                    let high = findHigh(diff.epoch_days[i], c.skill_order, allHighs, c.max_rarity);

                    if (!curr) {
                        curr = {
                            day: iso,
                            epoch_day: diff.epoch_days[i],
                            entries: 1,
                            value: skillsum,
                            year: d.getUTCFullYear(),
                            rarities: [diff.rarity],
                            symbols: [diff.symbols[i]],
                            diffs: [diff.skill_diffs.reduce((p,n)=>p+n)],
                            crew: [c],
                            highs: high ? [high] : []
                        }
                        newData.push(curr);
                    }
                    else {
                        if (!curr.symbols.includes(diff.symbols[i])) {
                            curr.value += skillsum;
                            curr.entries++;
                            curr.rarities.push(diff.rarity);
                            curr.diffs.push(diff.skill_diffs.reduce((p,n)=>p+n));
                            curr.symbols.push(diff.symbols[i]);
                            curr.crew.push(c);
                            if (high) curr.highs.push(high);
                        }
                    }
                }
            }
            newData.sort((a, b) => a.day.localeCompare(b.day));
            newData.forEach((data) => {
                data.crew.sort((a, b) => b.max_rarity - a.max_rarity || a.name.localeCompare(b.name));
                let avgr = data.rarities.reduce((p,n) => p + n) / data.rarities.length;
                data.value /= data.crew.length;
                data.value *= avgr;
                let highbump = data.highs.filter(f => f.epoch_day === data.epoch_day);
                if (highbump.length) {
                    let agg = highbump.reduce((p, n) => n.aggregate_sum + p, 0) / highbump.length;
                    data.value *= (1 + agg);
                }

            })
            newYears.push(newData);
        }
        setReleaseTable(newYears.flat().sort((a, b) => a.day.localeCompare(b.day)));
    }, [epochDiffs, allHighs]);

    if (!releaseTable.length) return;

    const flexRow = OptionsPanelFlexRow;
    const flexCol = OptionsPanelFlexColumn;

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'stretch',
            alignItems: 'center',
            gap: '1em',
            margin: '1em 0'
        }}>

            {!!releaseTable?.length && [releaseTable].map((year, idx) => {
                return <div style={{height: `${totalYears * 13}em`, width: '100%'}} key={`stats_year_calendar_${year.length ? year[0].year : '0'}_${idx}`}>
                    <ResponsiveCalendar
                        theme={themes.dark}
                        data={year}
                        from={new Date(`${year[year.length - 1].year}-12-31`)}
                        to={new Date(`2015-01-01T00:00:00Z`)}
                        emptyColor="#333"
                        colors={[ 'goldenrod', 'darkgreen', 'teal', 'green', 'aquamarine', 'lightgreen' ]}
                        margin={{ top: 40, right: 40, bottom: 40, left: 40 }}
                        yearSpacing={40}
                        monthBorderColor="#666"
                        dayBorderWidth={2}
                        dayBorderColor="#666"
                        tooltip={(node: any) => {
                            const data = node.data as CalendarData;

                            return <div className='ui segment' style={{zIndex: '1000'}}>
                                <div style={{display: 'flex'}}>
                                    <CrewTiles
                                        style={{maxWidth: '30vw', textAlign: 'center'}}
                                        maxCrew={5}
                                        rich={true}
                                        crew={data.crew}
                                        pageId="stats_calendar"
                                        avatarSize={64}
                                        miniSkills={true}
                                        extraMessage={<Label color='blue'>{t('stat_trends.new_high')}</Label>}
                                        displayExtraMessage={(crew) => data.highs.some(s => s.crew.symbol === crew.symbol)}
                                    />
                                </div>
                            </div>
                        }}
                        legends={[
                            {
                                anchor: 'bottom-right',
                                direction: 'row',
                                translateY: 36,
                                itemCount: 4,
                                itemWidth: 42,
                                itemHeight: 36,
                                itemsSpacing: 14,
                                itemDirection: 'right-to-left'
                            }
                        ]}
                    />

                </div>
            })}
        </div>)
}