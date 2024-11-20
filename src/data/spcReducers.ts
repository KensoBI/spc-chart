import { Field, FieldCalcs } from '@grafana/data';

export enum ControlLineReducerId {
  custom = 'custom',
  nominal = 'nominal',
  lsl = 'lsl',
  usl = 'usl',
  min = 'min',
  max = 'max',
  mean = 'mean',
  range = 'range',
  lcl = 'lcl',
  ucl = 'ucl',
  stdDev = 'stdDev',
  variance = 'variance',
}

type SpcReducer = (field: Field, subgroupSize: number) => FieldCalcs;

export interface ControlLineReducer {
  id: ControlLineReducerId;
  name: string;
  description?: string;
  computed: boolean;
  isStandard: boolean;
  color: string;
  reduce?: SpcReducer;
}

export const controlLineReducers: ControlLineReducer[] = [
  {
    id: ControlLineReducerId.custom,
    name: 'Custom',
    description: 'Draws custom control line.',
    computed: false,
    isStandard: false,
    color: '#37872d',
  },
  {
    id: ControlLineReducerId.nominal,
    name: 'Nominal',
    description: 'Draws nominal control line.',
    computed: false,
    isStandard: false,
    color: '#37872d',
  },
  {
    id: ControlLineReducerId.lsl,
    name: 'LSL',
    description: 'Draws the LCL (Lower Control Limit), marking the lower boundary of the control chart.',
    computed: false,
    isStandard: false,
    color: '#C4162A',
  },
  {
    id: ControlLineReducerId.usl,
    name: 'USL',
    description: 'Draws the USL (Upper Control Limit), marking the upper boundary of the control chart.',
    computed: false,
    isStandard: false,
    color: '#C4162A',
  },
  {
    id: ControlLineReducerId.min,
    name: 'Minimum',
    description: 'Computes and draws the minimum of the sample values.',
    computed: true,
    isStandard: true,
    color: '#5794F2',
  },
  {
    id: ControlLineReducerId.max,
    name: 'Maximum',
    description: 'Computes and draws the maximum of the sample values.',
    computed: true,
    isStandard: true,
    color: '#5794F2',
  },
  {
    id: ControlLineReducerId.mean,
    name: 'Mean',
    description: 'Computes and draws the average (arithmetic mean) of all the sample values.',
    computed: true,
    isStandard: true,
    color: '#1F60C4',
  },
  {
    id: ControlLineReducerId.range,
    name: 'Range',
    description: 'Computes and draws the range (arithmetic range) of all the sample values.',
    computed: true,
    isStandard: true,
    color: '#B877D9',
  },
  {
    id: ControlLineReducerId.lcl,
    name: 'LCL',
    description: 'Draws the LCL (Lower Control Limit), marking the lower boundary of the control chart.',
    computed: true,
    isStandard: false,
    color: '#F2495C',
  },
  {
    id: ControlLineReducerId.ucl,
    name: 'UCL',
    description: 'Draws the USL (Upper Control Limit), marking the upper boundary of the control chart.',
    computed: true,
    isStandard: false,
    color: '#F2495C',
  },
];
