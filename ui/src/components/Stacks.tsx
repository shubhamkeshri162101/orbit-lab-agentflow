import type { CSSProperties } from "react";
import { styled } from "styled-components";

export type FlexProperties = Partial<{
  justifyContent: CSSProperties["justifyContent"];
  alignItems: CSSProperties["alignItems"];
  flex: CSSProperties["flex"];
  gap: CSSProperties["gap"];
}>;

const shouldForwardProp = (prop: string) =>
  !["justifyContent", "alignItems", "flex", "gap"].includes(prop);

export const HStack = styled("div").withConfig({ shouldForwardProp })<FlexProperties>`
  display: flex;
  flex-direction: row;

  justify-content: ${({ justifyContent }) => justifyContent || "normal"};
  align-items: ${({ alignItems }) => alignItems || "normal"};
  flex: ${({ flex }) => flex || "initial"};
  gap: ${({ gap }) => (typeof gap === "number" ? `${gap}px` : gap || "0px")};
`;

export const VStack = styled("div").withConfig({ shouldForwardProp })<FlexProperties>`
  display: flex;
  flex-direction: column;

  justify-content: ${({ justifyContent }) => justifyContent || "normal"};
  align-items: ${({ alignItems }) => alignItems || "normal"};
  flex: ${({ flex }) => flex || "initial"};
  gap: ${({ gap }) => (typeof gap === "number" ? `${gap}px` : gap || "0px")};
`;
