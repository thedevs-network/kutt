import { Document, model, Schema, Types } from 'mongoose';

export interface IVisit extends Document {
  browser: {
    chrome: number;
    edge: number;
    firefox: number;
    ie: number;
    opera: number;
    other: number;
    safari: number;
  };
  country: Record<string, number>;
  date: Date;
  link: Types.ObjectId;
  os: {
    android: number;
    ios: number;
    linux: number;
    macos: number;
    other: number;
    windows: number;
  };
  referrer: Record<string, number>;
  total: number;
}

const VisitSchema: Schema = new Schema({
  browser: {
    chrome: { type: Number, default: 0 },
    edge: { type: Number, default: 0 },
    firefox: { type: Number, default: 0 },
    ie: { type: Number, default: 0 },
    opera: { type: Number, default: 0 },
    other: { type: Number, default: 0 },
    safari: { type: Number, default: 0 },
  },
  country: Schema.Types.Mixed,
  date: { type: Date },
  link: { type: Schema.Types.ObjectId, ref: 'link' },
  os: {
    android: { type: Number, default: 0 },
    ios: { type: Number, default: 0 },
    linux: { type: Number, default: 0 },
    macos: { type: Number, default: 0 },
    other: { type: Number, default: 0 },
    windows: { type: Number, default: 0 },
  },
  referrer: Schema.Types.Mixed,
  total: { type: Number, default: 0 },
});

const Visit = model<IVisit>('visit', VisitSchema);

export default Visit;
