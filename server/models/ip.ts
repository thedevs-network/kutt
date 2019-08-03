import { Document, model, Schema } from 'mongoose';

export interface IIP extends Document {
  createdAt?: Date;
  updatedAt?: Date;
  ip: string;
}

const IpSchema: Schema = new Schema({
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  ip: { type: String, required: true, trim: true },
});

const IP = model<IIP>('ip', IpSchema);

export default IP;
