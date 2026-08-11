<?php

namespace App\Support;

final class SimplePdf
{
    public static function document(string $title, array $headers, array $rows): string
    {
        $lines = [strtoupper($title), str_repeat('-', 110), implode(' | ', $headers), str_repeat('-', 110)];
        foreach ($rows as $row) {
            $text = implode(' | ', array_map(fn ($v) => trim(preg_replace('/\s+/', ' ', (string) ($v ?? ''))), $row));
            foreach (self::wrap($text, 105) as $part) $lines[] = $part;
        }
        $pages = array_chunk($lines, 46);
        $objects = [];
        $pageIds = [];
        $fontId = 3;
        $nextId = 4;
        foreach ($pages as $pageLines) {
            $contentId = $nextId++;
            $pageId = $nextId++;
            $pageIds[] = $pageId;
            $stream = "BT\n/F1 9 Tf\n40 800 Td\n12 TL\n";
            foreach ($pageLines as $line) $stream .= '(' . self::escape($line) . ") Tj\nT*\n";
            $stream .= "ET\n";
            $objects[$contentId] = "<< /Length " . strlen($stream) . " >>\nstream\n{$stream}endstream";
            $objects[$pageId] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 {$fontId} 0 R >> >> /Contents {$contentId} 0 R >>";
        }
        $kids = implode(' ', array_map(fn ($id) => "{$id} 0 R", $pageIds));
        $objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
        $objects[2] = "<< /Type /Pages /Kids [{$kids}] /Count " . count($pageIds) . ' >>';
        $objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
        ksort($objects);
        $pdf = "%PDF-1.4\n";
        $offsets = [0];
        $maxId = max(array_keys($objects));
        for ($id = 1; $id <= $maxId; $id++) {
            $offsets[$id] = strlen($pdf);
            $body = $objects[$id] ?? '<< >>';
            $pdf .= "{$id} 0 obj\n{$body}\nendobj\n";
        }
        $xref = strlen($pdf);
        $pdf .= "xref\n0 " . ($maxId + 1) . "\n0000000000 65535 f \n";
        for ($id = 1; $id <= $maxId; $id++) $pdf .= sprintf("%010d 00000 n \n", $offsets[$id]);
        $pdf .= "trailer\n<< /Size " . ($maxId + 1) . " /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF";
        return $pdf;
    }

    private static function escape(string $value): string
    {
        $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value) ?: $value;
        return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $ascii);
    }

    private static function wrap(string $text, int $width): array
    {
        $parts = wordwrap($text, $width, "\n", true);
        return explode("\n", $parts);
    }
}
