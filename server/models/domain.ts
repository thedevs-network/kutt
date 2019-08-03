import { Document, model, Schema, Types } from 'mongoose';

export interface IDomain extends Document {
  banned?: boolean;
  bannedBy?: Types.ObjectId;
  createdAt: Date;
  name: string;
  homepage?: string;
  updatedAt?: Date;
  user?: Types.ObjectId;
}

const DomainSchema: Schema = new Schema({
  banned: { type: Boolean, default: false },
  bannedBy: { type: Schema.Types.ObjectId, ref: 'user' },
  createdAt: { type: Date, default: Date.now },
  name: { type: String, unique: true, trim: true, required: true },
  homepage: { type: String, trim: true },
  updatedAt: { type: Date, default: Date.now },
  user: { type: Schema.Types.ObjectId, ref: 'user' },
});

const Domain = model<IDomain>('domain', DomainSchema);

export default Domain;
