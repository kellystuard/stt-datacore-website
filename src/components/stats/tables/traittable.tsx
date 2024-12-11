import React from "react"
import { GlobalContext } from "../../../context/globalcontext"
import { ITableConfigRow, SearchableTable } from "../../searchabletable";
import { EpochDiff } from "../model";
import { Checkbox, Table } from "semantic-ui-react";
import { dateToEpoch, formatElapsedDays, GameEpoch, OptionsPanelFlexColumn, OptionsPanelFlexRow } from "../utils";
import 'moment/locale/fr';
import 'moment/locale/de';
import 'moment/locale/es';
import moment from "moment";
import { AvatarView } from "../../item_presenters/avatarview";
import { CrewMember } from "../../../model/crew";
import { omniSearchFilter } from "../../../utils/omnisearch";
import { useStateWithStorage } from "../../../utils/storage";
import { getVariantTraits } from "../../../utils/crewutils";
import { getIconPath } from "../../../utils/assets";


interface TraitStats {
    trait: string,
    trait_raw: string,
    collection: string,
    first_appearance: Date
    first_crew: CrewMember,
    latest_crew: CrewMember,
    launch_crew?: CrewMember,
    total_crew: number,
    hidden: boolean,
    icon?: string,
    retro?: number,
}

const SpecialCols = {
    original: 34,
    dsc: 20,
    ent: 66,
    voy: 74,
    q: 31,
    evsuit: 38,
    ageofsail: 37,
    exclusive_gauntlet: 32,
    low: 54,
    tas: 54,
    vst: 54,
    crew_max_rarity_3: 16,
    crew_max_rarity_2: 15,
    crew_max_rarity_1: 14,
    niners: 29,
};

export const TraitStatsTable = () => {

    const globalContext = React.useContext(GlobalContext);
    const { t, TRAIT_NAMES, COLLECTIONS } = globalContext.localized;
    const { crew, collections, keystones } = globalContext.core;
    const [stats, setStats] = React.useState<TraitStats[]>([]);
    const [showHidden, setShowHidden] = useStateWithStorage<boolean>('stat_trends/traits/show_hidden', false, { rememberForever: true });
    const [hideOne, setHideOne] = useStateWithStorage<boolean>('stat_trends/traits/hide_one', false, { rememberForever: true });
    const [showVariantTraits, setShowVariantTraits] = useStateWithStorage<boolean>('stat_trends/traits/show_variant_traits', true, { rememberForever: true });
    const flexRow = OptionsPanelFlexRow;
    const flexCol = OptionsPanelFlexColumn;


    const calcReleaseVague = (min: number, max: number) => {
        let d = new Date(GameEpoch);
        let dn = ((max - min) / 4) + 91;
        d.setDate(d.getDate() + dn);
        return d;
    }

    const calcRelease = (number: number, items: { id: number, date: Date }[]) => {
        let n = -1;
        let nidx = -1;
        let i = 0;
        for (let item of items) {
            if (item.id > number) break;
            let z = number - item.id;
            if (z >= 0 && (n === -1 || z < n)) {
                n = z;
                nidx = i;
            }
            i++;
        }
        if (n < 0 || nidx < 0) return new Date(GameEpoch);
        let d = new Date(items[nidx].date);
        d.setHours(d.getHours() - ((number - n) / 40));
        return d;
    }

    const approxDate = (d: Date) => {
        let m = (d.getMonth() + 1);
        if (m <= 3) return `${t('global.approx')} ${t('global.quarter_short')}1 ${d.getUTCFullYear()}`;
        if (m <= 6) return `${t('global.approx')} ${t('global.quarter_short')}2 ${d.getUTCFullYear()}`;
        if (m <= 9) return `${t('global.approx')} ${t('global.quarter_short')}3 ${d.getUTCFullYear()}`;
        return `${t('global.approx')} ${t('global.quarter_short')}4 ${d.getUTCFullYear()}`;
    }

    const colSpecialDate = (c: string) => {
        let reg = /^([a-z]+)(\d+)$/;
        if (reg.test(c)) {
            let res = reg.exec(c);
            if (res && res[2].length === 4) {
                return new Date(`${res[1]} ${res[2]}`);
            }
        }
        return null;
    }

    React.useEffect(() => {
        if (!crew?.length) return;
        let work = [...crew];
        work.sort((a, b) => a.date_added.getTime() - b.date_added.getTime() || (a.name_english || a.name).localeCompare(b.name_english ?? b.name));
        let crewitems = crew.map(c => {
            let symbol = c.equipment_slots.findLast(f => f.level >= 99)?.symbol ?? '';
            let item = globalContext.core.items.find(f => f.symbol === symbol);
            if (item) {
                return {
                    id: Number(item.id),
                    date: c.date_added
                }
            }
            else return {
                id: 0,
                date: new Date()
            }
        }).filter(f => f.id).sort((a, b) => a.id - b.id);

        let workstones = [...keystones];
        workstones.sort((a, b) => a.id - b.id);

        const stones = {} as { [key: string]: Date }
        const stoneicons = {} as { [key: string]: string }
        const ntraits = [] as string[];
        const htraits = [] as string[];
        const min = workstones[0].id;
        workstones.forEach((ks) => {
            if (ks.symbol.endsWith("_crate")) return;
            let t = ks.symbol.replace("_keystone", "");
            let d = calcReleaseVague(min, ks.id);
            if (d.getUTCFullYear() >= 2021) d = calcRelease(ks.id, crewitems);
            stones[t] = d;
            stoneicons[t] = getIconPath(ks.icon);
        });

        work.forEach((c) => {
            const variants = getVariantTraits(c);
            c.traits.forEach(ct => {
                if (!showVariantTraits && variants.includes(ct)) return;
                if (!ntraits.includes(ct) && !htraits.includes(ct)) ntraits.push(ct);
            });
            if (showHidden) {
                c.traits_hidden.forEach(ct => {
                    if (!showVariantTraits && variants.includes(ct)) return;
                    if (!htraits.includes(ct) && !ntraits.includes(ct)) htraits.push(ct);
                });
            }
        });

        const outstats = [] as TraitStats[];

        [ntraits, htraits].forEach((traitset, idx) => {
            const hidden = idx === 1;
            traitset.forEach((trait) => {
                let tcrew = work.filter(c => (!hidden ? c.traits : c.traits_hidden).includes(trait));
                if (!tcrew.length) return;
                if (hideOne && tcrew.length === 1) return;
                let d = colSpecialDate(trait) || stones[trait];
                let release = d && (d.getUTCFullYear() === 2016 && d.getMonth() < 6);
                if (!d || d.getTime() < tcrew[0].date_added.getTime()) {
                    d = tcrew[0].date_added;
                }
                let rcrew = tcrew.filter(c => c.date_added.getTime() < d.getTime() - (1000 * 24 * 60 * 60 * 10));
                const newtrait = {
                    trait: TRAIT_NAMES[trait] || trait,
                    trait_raw: trait,
                    collection: '',
                    first_appearance: d,
                    first_crew: tcrew[0],
                    latest_crew: tcrew[tcrew.length - 1],
                    total_crew: tcrew.length,
                    hidden,
                    retro: release ? 0 : rcrew.length,
                    icon: stoneicons[trait]
                } as TraitStats;
                if (!hidden || SpecialCols[trait]) {
                    if (SpecialCols[trait]) {
                        let col = collections.find(f => f.id == SpecialCols[trait]);
                        if (col) {
                            newtrait.collection = COLLECTIONS[`cc-${col.type_id}`]?.name ?? col.name
                        }
                    }
                    else {
                        let col = collections.find(f => f.description?.toLowerCase().includes(">" + (TRAIT_NAMES[trait]?.toLowerCase() ?? '') + "<"));
                        if (col) {
                            newtrait.collection = COLLECTIONS[`cc-${col.type_id}`]?.name ?? col.name
                        }
                    }
                }
                else {
                    newtrait.collection = ''
                }
                tcrew.sort((a, b) => {
                    let adiff = Math.abs(a.date_added.getTime() - d.getTime());
                    let bdiff = Math.abs(b.date_added.getTime() - d.getTime());
                    let r = adiff - bdiff;
                    if (!r) r = a.name.localeCompare(b.name);
                    return r;
                });
                if (Math.abs(tcrew[0].date_added.getTime() - d.getTime()) <= (1000 * 24 * 60 * 60 * 10)) {
                    if (tcrew[0].symbol !== newtrait.first_crew.symbol)
                        newtrait.launch_crew = tcrew[0];
                }
                else if (!release) {
                    let t = tcrew.find(f => d.getTime() < f.date_added.getTime());
                    if (t) newtrait.launch_crew = t;
                }
                if (!newtrait.launch_crew || newtrait.launch_crew?.symbol === newtrait.latest_crew?.symbol) newtrait.retro = 0;

                outstats.push(newtrait);
            });
        });

        setStats(outstats);
    }, [crew, showHidden, showVariantTraits, hideOne]);

    const tableConfig = [
        { width: 1, column: 'trait', title: t('stat_trends.trait_columns.trait') },
        {
            width: 1,
            column: 'hidden',
            title: t('stat_trends.trait_columns.hidden'),
            customCompare: (a: TraitStats, b: TraitStats) => {
                if (a.hidden == b.hidden) return a.trait.localeCompare(b.trait)
                if (!a.hidden) return -1;
                else if (!b.hidden) return 1;
                return 0;
            }
        },
        { width: 1, column: 'collection', title: t('stat_trends.trait_columns.collection') },
        {
            width: 1,
            column: 'first_appearance',
            title: t('stat_trends.trait_columns.first_appearance'),
            customCompare: (a: TraitStats, b: TraitStats) => {
                return a.first_appearance.getTime() - b.first_appearance.getTime();
            }
        },
        {
            width: 1,
            column: 'first_crew',
            title: t('stat_trends.trait_columns.first_crew'),
            customCompare: (a: TraitStats, b: TraitStats) => {
                return a.first_crew.date_added.getTime() - b.first_crew.date_added.getTime() || a.first_crew.name.localeCompare(b.first_crew.name)
            }
        },
        {
            width: 1,
            column: 'launch_crew',
            title: t('stat_trends.trait_columns.inaugural_crew'),
            customCompare: (a: TraitStats, b: TraitStats) => {
                if (a.launch_crew == b.launch_crew) return 0;
                else if (!a.launch_crew) return 1;
                else if (!b.launch_crew) return -1;
                return a.launch_crew.date_added.getTime() - b.launch_crew.date_added.getTime() || a.launch_crew.name.localeCompare(b.launch_crew.name)
            }
        },
        {
            width: 1,
            column: 'latest_crew',
            title: t('stat_trends.trait_columns.latest_crew'),
            customCompare: (a: TraitStats, b: TraitStats) => {
                return a.latest_crew.date_added.getTime() - b.latest_crew.date_added.getTime() || a.latest_crew.name.localeCompare(b.latest_crew.name)
            }
        },
        { width: 1, column: 'total_crew', title: t('stat_trends.trait_columns.total_crew') },
    ] as ITableConfigRow[]
    if (!showHidden) {
        tableConfig.splice(1, 1);
    }
    return (
        <div style={{...flexCol, alignItems: 'stretch', justifyContent: 'flex-start', width: '100%', overflowX: 'auto' }}>
            <div style={flexRow}>
                <div style={{...flexCol, alignItems: 'flex-start', justifyContent: 'flex-start', gap: '1em', margin: '1em 0'}}>
                    <Checkbox label={t('stat_trends.traits.hide_only_one')}
                        checked={hideOne}
                        onChange={(e, { checked }) => setHideOne(!!checked) }
                    />
                    <Checkbox label={t('stat_trends.traits.show_hidden')}
                        checked={showHidden}
                        onChange={(e, { checked }) => setShowHidden(!!checked) }
                    />
                    <Checkbox label={t('stat_trends.traits.show_variant_traits')}
                        disabled={!showHidden}
                        checked={showVariantTraits}
                        onChange={(e, { checked }) => setShowVariantTraits(!!checked) }
                    />
                </div>
            </div>
            <SearchableTable
                data={stats}
                renderTableRow={(item, idx) => renderTableRow(item, idx)}
                config={tableConfig}
                filterRow={filterRow}
                />
        </div>)

    function filterRow(row: any, filter: any, filterType?: string) {
        if (filter) {
            return omniSearchFilter(row, filter, filterType, ['trait', 'collection', {
                field: 'first_crew',
                customMatch: (a: CrewMember, text) => {
                    return a.name.toLowerCase().includes(text.toLowerCase());
                }
            }])
        }
        return true;
    }

    function renderTableRow(item: TraitStats, idx: any) {
        const fcrew = item.first_crew;
        const lcrew = item.latest_crew;

        return <Table.Row key={`traitSetIdx_${idx}`}>
                <Table.Cell>
                    <div style={{...flexRow, justifyContent: 'flex-start', gap: '1em'}}>
                        {!!item.icon && <img src={item.icon} style={{height: '32px'}} />}
                        <span>{item.trait}</span>
                    </div>

                </Table.Cell>
                {showHidden && <Table.Cell>
                    {item.hidden && t('global.yes')}
                    {!item.hidden && t('global.no')}
                </Table.Cell>}
                <Table.Cell>
                    {item.collection}
                </Table.Cell>
                <Table.Cell>
                    {/* {moment(item.first_appearance).utc(false).locale(globalContext.localized.language === 'sp' ? 'es' : globalContext.localized.language).format("MMM D, y")} */}
                    {approxDate(item.first_appearance)}
                </Table.Cell>
                <Table.Cell>
                    <div style={{...flexCol, textAlign: 'center', gap: '1em'}}>
                        <AvatarView
                            targetGroup="stat_trends_crew"
                            mode='crew'
                            item={fcrew}
                            size={48}
                            />
                        <i>{fcrew.name}</i>
                    </div>
                </Table.Cell>
                <Table.Cell>
                    {!!item.launch_crew && <div style={{...flexCol, textAlign: 'center', gap: '1em'}}>
                        <AvatarView
                            targetGroup="stat_trends_crew"
                            mode='crew'
                            item={item.launch_crew}
                            size={48}
                            />
                        <i>{item.launch_crew.name}</i>
                    </div>}
                </Table.Cell>
                <Table.Cell>
                    <div style={{...flexCol, textAlign: 'center', gap: '1em'}}>
                        <AvatarView
                            targetGroup="stat_trends_crew"
                            mode='crew'
                            item={lcrew}
                            size={48}
                            />
                        <i>{lcrew.name}</i>
                    </div>
                </Table.Cell>
                <Table.Cell style={{textAlign: 'center'}}>
                    {item.total_crew.toLocaleString()}
                    {!!item.retro && <>
                        <br />
                        <i>({t('stat_trends.traits.retroactively_added_to_n_crew', { n: item.retro.toLocaleString() })})</i>
                    </>}
                </Table.Cell>
        </Table.Row>
    }



}