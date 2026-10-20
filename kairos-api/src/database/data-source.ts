import 'dotenv/config';
import { DataSource } from 'typeorm';
import { opcoesDoBanco } from './opcoes';

export default new DataSource(opcoesDoBanco);
