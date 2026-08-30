import type {Metadata} from "next";
import {headers} from "next/headers";
import {listDatabaseTables} from "../../../db/database-console";
import DatabaseConsole from "../../area-privata/DatabaseConsole";
import {PrivateHeader,PrivateLogin} from "../../area-privata/PrivateChrome";
import {authIsConfigured,privateUserFromCookie} from "../../lib/google-auth";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Database | VALF Suite",robots:{index:false,follow:false}};
export default async function DatabasePage(){const requestHeaders=await headers();const user=await privateUserFromCookie(requestHeaders.get("cookie"));if(!user)return <PrivateLogin configured={authIsConfigured()}/>;const tables=await listDatabaseTables();return <main className="dashboard-page"><PrivateHeader user={user} active="database"/><DatabaseConsole tables={tables}/></main>;}
