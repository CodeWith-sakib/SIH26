import { Document, Schema, Types, model } from 'mongoose';

export type ProtocolType = 'REST' | 'SOAP';

export type AuthType = 'NONE' | 'API_KEY' | 'JWT';

export interface AuthConfig {
  type: AuthType;
  apiKey?: {
    headerName: string;
    value: string;
  };
  jwt?: {
    tokenUrl?: string;
    clientId?: string;
    clientSecret?: string;
    scopes?: string[];
  };
}

export interface RequestConfig {
  method: string;
  path: string;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  bodyMapping?: Record<string, string>;
  soapAction?: string;
  namespace?: Record<string, string>;
}

export interface ResponseConfig {
  dataPath: string;
  statusCodePath?: string;
}

export interface FieldMapping {
  sourceField: string;
  canonicalField: string;
  transform?: 'uppercase' | 'lowercase' | 'trim' | 'date' | 'number';
}

export interface IntegrationDocument extends Document {
  departmentId: Types.ObjectId;
  name: string;
  protocol: ProtocolType;
  baseUrl: string;
  authentication: AuthConfig;
  request: RequestConfig;
  response: ResponseConfig;
  fieldMappings: FieldMapping[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const fieldMappingSchema = new Schema<FieldMapping>(
  {
    sourceField: {
      type: String,
      required: true,
      trim: true
    },
    canonicalField: {
      type: String,
      required: true,
      trim: true
    },
    transform: {
      type: String,
      enum: ['uppercase', 'lowercase', 'trim', 'date', 'number']
    }
  },
  { _id: false }
);

const authConfigSchema = new Schema<AuthConfig>(
  {
    type: {
      type: String,
      enum: ['NONE', 'API_KEY', 'JWT'],
      required: true
    },
    apiKey: {
      headerName: { type: String, trim: true },
      value: { type: String }
    },
    jwt: {
      tokenUrl: { type: String, trim: true },
      clientId: { type: String, trim: true },
      clientSecret: { type: String },
      scopes: [{ type: String, trim: true }]
    }
  },
  { _id: false }
);

const requestConfigSchema = new Schema<RequestConfig>(
  {
    method: {
      type: String,
      required: true,
      trim: true
    },
    path: {
      type: String,
      required: true,
      trim: true
    },
    headers: { type: Schema.Types.Mixed },
    queryParams: { type: Schema.Types.Mixed },
    bodyMapping: { type: Schema.Types.Mixed },
    soapAction: { type: String, trim: true },
    namespace: { type: Schema.Types.Mixed }
  },
  { _id: false }
);

const responseConfigSchema = new Schema<ResponseConfig>(
  {
    dataPath: {
      type: String,
      required: true,
      trim: true
    },
    statusCodePath: {
      type: String,
      trim: true
    }
  },
  { _id: false }
);

const integrationSchema = new Schema<IntegrationDocument>(
  {
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    protocol: {
      type: String,
      enum: ['REST', 'SOAP'],
      required: true
    },
    baseUrl: {
      type: String,
      required: true,
      trim: true
    },
    authentication: {
      type: authConfigSchema,
      required: true
    },
    request: {
      type: requestConfigSchema,
      required: true
    },
    response: {
      type: responseConfigSchema,
      required: true
    },
    fieldMappings: {
      type: [fieldMappingSchema],
      default: []
    },
    active: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

const Integration = model<IntegrationDocument>('Integration', integrationSchema);

export default Integration;