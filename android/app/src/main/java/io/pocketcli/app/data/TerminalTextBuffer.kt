package io.pocketcli.app.data

class TerminalTextBuffer(
    private val maxLines: Int = 2000,
) {
    private val lines = mutableListOf(StringBuilder())
    private var column = 0

    fun clear() {
        lines.clear()
        lines += StringBuilder()
        column = 0
    }

    fun replace(chunks: List<String>): String {
        clear()
        chunks.forEach(::appendChunk)
        return buildText()
    }

    fun appendChunk(chunk: String): String {
        val sanitized = chunk
            .replace(ANSI_PATTERN, "")
            .replace(OSC_PATTERN, "")

        for (character in sanitized) {
            when (character) {
                '\r' -> column = 0
                '\n' -> newLine()
                '\b' -> backspace()
                '\t' -> repeat(4) { appendChar(' ') }
                else -> if (!character.isISOControl()) {
                    appendChar(character)
                }
            }
        }

        trimLines()
        return buildText()
    }

    private fun appendChar(character: Char) {
        val currentLine = lines.last()
        while (currentLine.length < column) {
            currentLine.append(' ')
        }

        if (column < currentLine.length) {
            currentLine.setCharAt(column, character)
        } else {
            currentLine.append(character)
        }
        column += 1
    }

    private fun newLine() {
        lines += StringBuilder()
        column = 0
    }

    private fun backspace() {
        if (column == 0) {
            return
        }

        column -= 1
        val currentLine = lines.last()
        if (column < currentLine.length) {
            currentLine.deleteCharAt(column)
        }
    }

    private fun trimLines() {
        while (lines.size > maxLines) {
            lines.removeAt(0)
        }
    }

    private fun buildText(): String = lines.joinToString(separator = "\n") { it.toString() }

    private companion object {
        val ANSI_PATTERN = Regex("""\u001B\[[0-?]*[ -/]*[@-~]""")
        val OSC_PATTERN = Regex("""\u001B\][^\u0007]*(\u0007|\u001B\\)""")
    }
}
