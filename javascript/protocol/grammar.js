Faye.Grammar = {
<% %w[  LOWALPHA    UPALPHA     ALPHA     DIGIT
        ALPHANUM    MARK        STRING    TOKEN
        INTEGER
        
        CHANNEL_SEGMENT         CHANNEL_SEGMENTS
        CHANNEL_NAME
        
        WILD_CARD               CHANNEL_PATTERN
        
        VERSION_ELEMENT         VERSION
        
        CLIENT_ID               ID
        
        ERROR_MESSAGE           ERROR_ARGS
        ERROR_CODE              ERROR ].each do |bnf| %>
  <%= bnf %>:     /<%= Faye::Grammar.const_get(bnf).source %>/<%= bnf == 'ERROR' ? '' : ',' %>
<% end %>
};

