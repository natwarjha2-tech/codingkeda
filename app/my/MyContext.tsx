"use client";
import { createContext, useContext } from "react";

export type MyUser = { id: string; name: string; email: string };

type Ctx = {
  user: MyUser | null;
  coins: number;
  refreshCoins: () => void;
};

export const MyContext = createContext<Ctx>({ user: null, coins: 0, refreshCoins: () => {} });
export const useMy = () => useContext(MyContext);
